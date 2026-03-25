"""
OCR processor for extracting lens information from box labels.
Uses PaddleOCR (primary) with Tesseract fallback for robust text extraction.
"""
import os

# MUST be set BEFORE importing PaddleOCR
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'

from typing import Dict, Optional, List, Tuple, Any
from PIL import Image, ImageEnhance, ImageOps
import numpy as np
import re

# OCR Engine availability flags
_PADDLEOCR_AVAILABLE = False
_TESSERACT_AVAILABLE = False
_paddle_ocr = None

# Initialize PaddleOCR (preferred engine)
try:
    from paddleocr import PaddleOCR
    # Use absolute minimal configuration for maximum compatibility
    _paddle_ocr = PaddleOCR(lang='en')
    _PADDLEOCR_AVAILABLE = True
    print("[OCR] PaddleOCR initialized successfully")
except Exception as e:
    print(f"[OCR] PaddleOCR not available: {e}")

# Initialize Tesseract (fallback)
try:
    import pytesseract
    # Test if tesseract is actually installed
    pytesseract.get_tesseract_version()
    _TESSERACT_AVAILABLE = True
    print("[OCR] Tesseract initialized successfully")
except Exception as e:
    print(f"[OCR] Tesseract not available: {e}")


class LensLabelOCR:
    """
    OCR processor for lens box labels.
    Extracts model and power information that may not be in barcodes.
    """
    
    # Model patterns (case-insensitive)
    MODEL_PATTERNS = [
        # Alcon models with # prefix (highest priority)
        r'#\s*(CNA0[TV]\d)\b',  # #CNA0T3, # CNA0V3, etc.
        r'#\s*(AN6VMT\d)\b',
        
        # Johnson & Johnson models
        r'\b(TECNIS)\b',
        r'\b(YG00D)\b',  # TECNIS Eyhance
        r'\b(ZCB00?)\b',
        r'\b(ZXT\d{3})\b',
        r'\b(DCB00?)\b',
        r'\b(DIB00?)\b',
        r'\b(DEN00?V?)\b',
        r'\b(DIU\d{3})\b',
        
        # Alcon models without # prefix
        r'\b(CNA0[TV]\d)\b',  # Clareon TORIC: CNA0T3, CNA0V3, etc.
        r'\b(AN6VMT\d)\b',
        r'\b(SN6[A-Z]{2}\d?)\b',
        r'\b(SA60AT)\b',
        r'\b(MA60MA)\b',
        r'\b(ACRYSOF)\b',
        
        # ZEISS models
        r'\b(CT\s?ASPHINA\s?\d{3})\b',
        r'\b(CT\s?LUCIA\s?\d{3})\b',
        r'\b(AT\s?LISA)\b',
        
        # Generic patterns (3-6 uppercase letters/digits)
        r'\b([A-Z]{3,6}\d{0,3})\b',
    ]
    
    # Power patterns - various formats found on lens boxes
    # Order matters: more specific patterns first
    POWER_PATTERNS = [
        # Combined sphere+cylinder format: +18.5 C+3.00D or +18.5C+3.00D (HIGHEST PRIORITY)
        r'([+-]?\d{1,2}\.\d+)\s*C\s*([+-]?\d{1,2}\.\d+D)',
        
        # Simple format with D suffix (most common): +20.5D, 23.5D, -5.0D (NO sign required)
        r'([+-]?\d{1,2}\.\d)D\b',
        
        # Bracket format: [23.50] or [+23.50] (common on some labels)
        r'\[([+-]?\d{1,2}\.?\d{0,2})\]',
        
        # SE (Spherical Equivalent) with label - MUST have colon or explicit format to avoid false positives
        r'(?:SE)\s*:?\s*([+-]?\d{1,2}\.?\d{0,2})\s*[CD]?',
        
        # Sphere power with label: SPH: +23.5D, Sphere +20.0
        r'(?:SPH|SPHERE|PWR|POWER)\s*:?\s*([+-]?\d{1,2}\.?\d{0,2})\s*D?',
        
        # Standard formats: +23.5D, -5.00D, +22.50D (but NOT after ADD or CYL)
        # Use negative lookbehind to avoid matching ADD/CYL power
        r'(?<!ADD\s)(?<!ADD\s:)(?<!ADD:)(?<!CYL\s)(?<!CYL\s:)(?<!CYL:)([+-]\d{1,2}\.?\d{0,2})\s*D(?:iop)?',
        
        # Reverse format: D+23.5, D-5.0
        r'D\s*([+-]?\d{1,2}\.?\d{0,2})',
        
        # ADD power (for multifocal lenses): ADD: +3.0D, ADD +2.5 - LOWEST PRIORITY
        r'ADD\s*:?\s*([+-]?\d{1,2}\.?\d{0,2})\s*D?',
    ]
    
    # Serial number patterns (10-11 digits)
    SN_PATTERNS = [
        r'\b([1-9]\d{10})\b',  # 11 digits (not starting with 0)
        r'\b([1-9]\d{9})\b',   # 10 digits (not starting with 0)
    ]
    
    def __init__(self, use_paddleocr: bool = True):
        """
        Initialize OCR processor.
        
        Args:
            use_paddleocr: Prefer PaddleOCR if available (default: True)
        """
        self.use_paddleocr = use_paddleocr and _PADDLEOCR_AVAILABLE
        self.engine = "paddleocr" if self.use_paddleocr else "tesseract"
        
        if not _PADDLEOCR_AVAILABLE and not _TESSERACT_AVAILABLE:
            raise RuntimeError("No OCR engine available. Install PaddleOCR or Tesseract.")
        
        print(f"[OCR] Using engine: {self.engine}")
    
    def preprocess_image(self, img: Image.Image, method: str = "auto") -> Image.Image:
        """
        Preprocess image for better OCR accuracy.
        
        Args:
            img: PIL Image
            method: Preprocessing method ("auto", "contrast", "grayscale", "threshold")
        
        Returns:
            Preprocessed PIL Image
        """
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize to optimal size for OCR (1200px for balance of speed and quality)
        width, height = img.size
        max_dim = max(width, height)
        target_size = 1200
        if max_dim > target_size or max_dim < target_size:
            scale = target_size / max_dim
            new_size = (int(width * scale), int(height * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            print(f"[OCR] Resized image from {width}x{height} to {new_size} for faster OCR")
        
        if method == "auto":
            # Auto-select best method based on image characteristics
            gray = img.convert('L')
            arr = np.array(gray)
            brightness = np.mean(arr)
            contrast = np.std(arr)
            
            # Apply preprocessing to enhance text visibility
            if contrast < 40:
                method = "strong_contrast"
            elif contrast < 60:
                method = "contrast"
            # Dark images need brightness adjustment
            elif brightness < 100:
                method = "brighten"
            else:
                method = "sharpen"
        
        if method == "original":
            return img
        
        elif method == "contrast":
            # Moderate contrast enhancement + sharpening
            from PIL import ImageFilter
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(2.0)
            img = img.filter(ImageFilter.SHARPEN)
            return img
        
        elif method == "strong_contrast":
            # Strong contrast enhancement for low-contrast images
            from PIL import ImageFilter
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(2.5)
            img = img.filter(ImageFilter.SHARPEN)
            return img
        
        elif method == "sharpen":
            # Sharpen edges for better text recognition
            from PIL import ImageFilter
            img = img.filter(ImageFilter.SHARPEN)
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.3)
            return img
        
        elif method == "grayscale":
            # Convert to grayscale with auto-levels
            gray = img.convert('L')
            return ImageOps.autocontrast(gray)
        
        elif method == "threshold":
            # Binary threshold for high contrast
            gray = img.convert('L')
            threshold = 128
            img_binary = gray.point(lambda x: 255 if x > threshold else 0)
            return img_binary
        
        elif method == "brighten":
            # Increase brightness
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(1.5)
            return img
        
        return img
    
    def extract_text_paddleocr(self, img: Image.Image) -> List[Tuple[str, float, List[List[int]]]]:
        """
        Extract text using PaddleOCR.
        
        Returns:
            List of (text, confidence, bbox) tuples
        """
        if not _PADDLEOCR_AVAILABLE:
            return []
        
        try:
            # Convert PIL to numpy array (RGB)
            img_array = np.array(img)
            
            # Run OCR without cls parameter (not supported in this version)
            # PaddleOCR.ocr() returns: [OCRResult object] (PaddleX wrapper)
            result = _paddle_ocr.ocr(img_array)
            
            # Debug logging - print detailed structure
            print(f"[OCR] PaddleOCR raw result: {type(result)}, length: {len(result) if result else 0}")
            if result and len(result) > 0:
                print(f"[OCR] First element type: {type(result[0])}, is None: {result[0] is None}")
                if result[0] is not None:
                    # Check if it's an OCRResult object
                    ocr_obj = result[0]
                    
                    # Print the object itself (might have __str__ or __repr__)
                    print(f"[OCR] OCRResult object: {ocr_obj}")
                    
                    # Try common methods
                    if hasattr(ocr_obj, 'json'):
                        print(f"[OCR] OCRResult.json type: {type(ocr_obj.json)}")
                        if callable(ocr_obj.json):
                            try:
                                json_result = ocr_obj.json
                                print(f"[OCR] OCRResult.json(): {json_result}")
                            except:
                                pass
                    
                    # Check if it has __getitem__
                    if hasattr(ocr_obj, '__getitem__'):
                        try:
                            print(f"[OCR] OCRResult keys (if dict-like): {list(ocr_obj.keys()) if hasattr(ocr_obj, 'keys') else 'N/A'}")
                        except:
                            pass
                    
                    # Try to access as array
                    try:
                        if hasattr(ocr_obj, '__len__') and len(ocr_obj) > 0:
                            print(f"[OCR] OCRResult can be indexed, length: {len(ocr_obj)}")
                    except:
                        pass
            
            # Parse results - handle OCRResult object
            texts = []
            if result and len(result) > 0 and result[0] is not None:
                ocr_result = result[0]
                
                # OCRResult is a dict-like object, access directly
                print(f"[OCR] Accessing ocr_result directly as dict: {type(ocr_result)}")
                
                # Get text and scores directly from OCRResult dict
                if isinstance(ocr_result, dict):
                    rec_texts = ocr_result.get('rec_texts', [])
                    rec_scores = ocr_result.get('rec_scores', [])
                    rec_polys = ocr_result.get('rec_polys', ocr_result.get('dt_polys', []))
                    
                    print(f"[OCR] Direct access - rec_texts: {len(rec_texts)}, rec_scores: {len(rec_scores)}")
                    
                    if rec_texts and rec_scores:
                        print(f"[OCR] Found {len(rec_texts)} texts and {len(rec_scores)} scores from direct dict access")
                        for i, (text, score) in enumerate(zip(rec_texts, rec_scores)):
                            bbox = rec_polys[i] if i < len(rec_polys) else None
                            texts.append((text, score, bbox))
                            print(f"[OCR] Added text {i}: '{text}' score={score:.4f}")
                    else:
                        print(f"[OCR] rec_texts or rec_scores empty from direct dict access")
                
                # Try direct attribute access
                if not texts and hasattr(ocr_result, 'rec_text'):
                    rec_texts = ocr_result.rec_text if isinstance(ocr_result.rec_text, list) else [ocr_result.rec_text]
                    rec_scores = ocr_result.rec_score if hasattr(ocr_result, 'rec_score') and isinstance(ocr_result.rec_score, list) else [1.0] * len(rec_texts)
                    dt_polys = ocr_result.dt_polys if hasattr(ocr_result, 'dt_polys') else [None] * len(rec_texts)
                    
                    for text, score, bbox in zip(rec_texts, rec_scores, dt_polys):
                        texts.append((text, score, bbox))
            
            print(f"[OCR] PaddleOCR extracted {len(texts)} text segments")
            return texts
        
        except Exception as e:
            print(f"[OCR] PaddleOCR extraction failed: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def extract_text_tesseract(self, img: Image.Image) -> List[Tuple[str, float, List[List[int]]]]:
        """
        Extract text using Tesseract with multiple PSM modes.
        
        Returns:
            List of (text, confidence, bbox) tuples
        """
        if not _TESSERACT_AVAILABLE:
            return []
        
        try:
            # Try multiple PSM modes for better accuracy
            # PSM 6: Assume uniform block of text
            # PSM 11: Sparse text, find as much text as possible
            # PSM 3: Fully automatic page segmentation
            psm_modes = ['--psm 6', '--psm 11', '--psm 3']
            
            best_results = []
            best_avg_confidence = 0.0
            
            for psm_config in psm_modes:
                try:
                    # Get detailed OCR data with bounding boxes
                    data = pytesseract.image_to_data(
                        img, 
                        config=f'{psm_config} --oem 3',
                        output_type=pytesseract.Output.DICT
                    )
                    
                    texts = []
                    confidences = []
                    n_boxes = len(data['text'])
                    
                    for i in range(n_boxes):
                        text = data['text'][i].strip()
                        conf = float(data['conf'][i])
                        
                        # Skip empty text or low confidence
                        if not text or conf < 0:
                            continue
                        
                        # Get bounding box
                        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                        bbox = [[x, y], [x+w, y], [x+w, y+h], [x, y+h]]
                        
                        texts.append((text, conf, bbox))
                        confidences.append(conf)
                    
                    # Calculate average confidence for this PSM mode
                    if confidences:
                        avg_conf = sum(confidences) / len(confidences)
                        
                        # Keep results with best average confidence
                        if avg_conf > best_avg_confidence:
                            best_avg_confidence = avg_conf
                            best_results = texts
                            print(f"[OCR] PSM mode {psm_config}: {len(texts)} texts, avg confidence: {avg_conf:.2f}")
                
                except Exception as e:
                    print(f"[OCR] PSM mode {psm_config} failed: {e}")
                    continue
            
            return best_results
        
        except Exception as e:
            print(f"[OCR] Tesseract extraction failed: {e}")
            return []
    
    def extract_text(self, img: Image.Image, preprocess: str = "auto") -> List[Tuple[str, float]]:
        """
        Extract text from image using available OCR engine.
        
        Args:
            img: PIL Image
            preprocess: Preprocessing method
        
        Returns:
            List of (text, confidence) tuples
        """
        # Preprocess image
        processed_img = self.preprocess_image(img, method=preprocess)
        
        # Extract using preferred engine
        if self.use_paddleocr:
            results = self.extract_text_paddleocr(processed_img)
        else:
            results = self.extract_text_tesseract(processed_img)
        
        # If primary engine fails or returns nothing, try fallback
        if not results:
            print(f"[OCR] {self.engine} returned no results, trying fallback...")
            if self.use_paddleocr and _TESSERACT_AVAILABLE:
                results = self.extract_text_tesseract(processed_img)
            elif not self.use_paddleocr and _PADDLEOCR_AVAILABLE:
                results = self.extract_text_paddleocr(processed_img)
        
        # Return simplified format (text, confidence)
        return [(text, conf) for text, conf, _ in results]
    
    def parse_model(self, texts: List[Tuple[str, float]]) -> Optional[str]:
        """
        Extract model from OCR text results.
        
        Args:
            texts: List of (text, confidence) tuples
        
        Returns:
            Model string or None
        """
        # Combine all text for pattern matching
        combined_text = " ".join([text for text, _ in texts])
        print(f"[OCR] Parsing model from text: {combined_text[:200]}")
        
        # PRIORITY 1: Look for # prefix (highest priority - Alcon models)
        hash_match = re.search(r'#\s*([A-Z0-9]+)', combined_text, re.IGNORECASE)
        if hash_match:
            model = hash_match.group(1).upper()
            # Normalize common OCR errors: O->0, l->1
            # NOTE: Do NOT replace S->5 as S is a valid character in lens model names (e.g., SN6AT)
            model = model.replace('O', '0').replace('l', '1')
            print(f"[OCR] Found model with # prefix: {model} (specificity: 100)")
            return model
        
        # PRIORITY 2: Try each model pattern - prefer specific model codes over brand names
        best_match = None
        best_specificity = 0
        
        for pattern in self.MODEL_PATTERNS:
            match = re.search(pattern, combined_text, re.IGNORECASE)
            if match:
                model = match.group(1).upper()
                # Calculate specificity: longer models and those with numbers are more specific
                specificity = len(model) + (10 if any(c.isdigit() for c in model) else 0)
                print(f"[OCR] Found potential model: {model} (specificity: {specificity})")
                
                if specificity > best_specificity:
                    best_match = model
                    best_specificity = specificity
        
        if best_match:
            print(f"[OCR] Selected best model: {best_match}")
            return best_match
        
        # PRIORITY 3: Try individual lines (more precise)
        for text, conf in texts:
            if conf > 0.7:  # Only consider high-confidence text
                text_upper = text.upper()
                # Look for model-like patterns
                if re.match(r'^[A-Z]{3,6}\d{0,3}$', text_upper):
                    print(f"[OCR] Found model (heuristic): {text_upper}")
                    return text_upper
        
        return None
    
    def parse_power(self, texts: List[Tuple[str, float]]) -> Optional[str]:
        """
        Extract power from OCR text results.
        
        Args:
            texts: List of (text, confidence) tuples
        
        Returns:
            Power string in format "+XX.XXD" or combined format "+XX.X C+X.XXD"
        """
        # Combine all text for pattern matching
        combined_text = " ".join([text for text, _ in texts])
        print(f"[OCR] Parsing power from text: {combined_text[:200]}")
        
        # First, check if there's a sign followed by power on separate text items
        # e.g., texts might be ['+', '23.5D'] instead of ['+23.5D']
        for i, (current_text, _) in enumerate(texts):
            # Check if this is a power value
            if re.match(r'^\d{1,2}\.\d+D$', current_text, re.IGNORECASE):
                # Look back for a sign
                if i > 0:
                    prev_text = texts[i-1][0]
                    if prev_text in ('+', '-'):
                        power = f"{prev_text}{current_text}"
                        print(f"[OCR] Found power with separate sign: {power}")
                        return power
                
                # No sign found, use default +
                power = f"+{current_text}"
                print(f"[OCR] Found power (added default +): {power}")
                return power
        
        # Try each power pattern in combined text
        for i, pattern in enumerate(self.POWER_PATTERNS):
            match = re.search(pattern, combined_text, re.IGNORECASE)
            if match:
                print(f"[OCR] Pattern {i} matched: {match.group(0)}")
                
                # Special handling for combined format (pattern 0): return full match
                if i == 0:  # Combined format like +18.5C+3.00D
                    power = match.group(0).upper()
                    # Ensure space before C for readability: +18.5C+3.00D -> +18.5 C+3.00D
                    power = re.sub(r'([+-]?\d+\.?\d*)\s*C\s*', r'\1 C', power)
                    print(f"[OCR] Found combined power: {power}")
                    return power
                
                power_value = match.group(1)
                print(f"[OCR] Extracted value: {power_value}")
                
                # Normalize format to +XX.XXD
                # Handle reverse format (D+23.5 -> +23.5D)
                if pattern.startswith('D'):
                    power = f"{power_value}D"
                else:
                    # Ensure sign is present
                    if not power_value.startswith(('+', '-')):
                        power_value = '+' + power_value
                    
                    # Ensure D suffix
                    if not match.group(0).upper().endswith('D'):
                        power = f"{power_value}D"
                    else:
                        power = f"{power_value}D"
                
                print(f"[OCR] Found power: {power}")
                return power
        
        print("[OCR] No power pattern matched")
        return None
    
    def parse_serial_number(self, texts: List[Tuple[str, float]]) -> Optional[str]:
        """
        Extract serial number from OCR text results.
        
        Args:
            texts: List of (text, confidence) tuples
        
        Returns:
            Serial number string or None
        """
        # Combine all text for pattern matching
        combined_text = " ".join([text for text, _ in texts])
        
        # Remove spaces and common separators for numeric matching
        combined_numeric = combined_text.replace(" ", "").replace("-", "").replace(":", "")
        
        # Try each SN pattern (prefer 11 digits over 10)
        for pattern in self.SN_PATTERNS:
            match = re.search(pattern, combined_numeric)
            if match:
                sn = match.group(1)
                print(f"[OCR] Found serial number: {sn}")
                return sn
        
        return None
    
    def extract_lens_info(
        self, 
        img: Image.Image,
        extract_model: bool = True,
        extract_power: bool = True,
        extract_sn: bool = True,
        preprocess_methods: List[str] = None
    ) -> Dict[str, Any]:
        """
        Extract lens information from box label image.
        
        Args:
            img: PIL Image of lens box label
            extract_model: Whether to extract model
            extract_power: Whether to extract power
            extract_sn: Whether to extract serial number
            preprocess_methods: List of preprocessing methods to try (default: ["auto", "contrast"])
        
        Returns:
            Dictionary with:
            - model: Model string or None
            - power: Power string or None
            - sn: Serial number or None
            - confidence: Overall confidence score (0-1)
            - ocr_engine: Engine used ("paddleocr" or "tesseract")
            - raw_text: All extracted text (for debugging)
        """
        if preprocess_methods is None:
            preprocess_methods = ["auto"]  # Single method for speed
        
        result = {
            "model": None,
            "power": None,
            "sn": None,
            "confidence": 0.0,
            "ocr_engine": self.engine,
            "raw_text": []
        }
        
        # Try multiple preprocessing methods
        all_texts = []
        for method in preprocess_methods:
            texts = self.extract_text(img, preprocess=method)
            all_texts.extend(texts)
            
            # Early exit if we found everything
            if extract_model and not result["model"]:
                result["model"] = self.parse_model(texts)
            if extract_power and not result["power"]:
                result["power"] = self.parse_power(texts)
            if extract_sn and not result["sn"]:
                result["sn"] = self.parse_serial_number(texts)
            
            # Stop if we found all requested fields
            has_all = (
                (not extract_model or result["model"]) and
                (not extract_power or result["power"]) and
                (not extract_sn or result["sn"])
            )
            if has_all:
                break
        
        # Remove duplicates
        unique_texts = list(set(all_texts))
        result["raw_text"] = unique_texts
        
        # Calculate overall confidence
        if unique_texts:
            avg_confidence = sum(conf for _, conf in unique_texts) / len(unique_texts)
            result["confidence"] = avg_confidence / 100.0 if avg_confidence > 1 else avg_confidence
        
        print(f"[OCR] Extraction result: model={result['model']}, power={result['power']}, sn={result['sn']}, confidence={result['confidence']:.2f}")
        
        return result


def extract_lens_info_from_image(
    img: Image.Image,
    extract_model: bool = True,
    extract_power: bool = True,
    extract_sn: bool = False  # Usually not needed since barcode has SN
) -> Dict[str, Any]:
    """
    Convenience function to extract lens information from image.
    
    Args:
        img: PIL Image
        extract_model: Extract model
        extract_power: Extract power
        extract_sn: Extract serial number (usually from barcode)
    
    Returns:
        Dictionary with model, power, sn, confidence, etc.
    """
    ocr = LensLabelOCR(use_paddleocr=True)
    return ocr.extract_lens_info(
        img,
        extract_model=extract_model,
        extract_power=extract_power,
        extract_sn=extract_sn
    )
