"""
Invoice Data Extraction Module - Self-Learning System

This module provides basic PDF text extraction functionality.
All extraction logic is delegated to the InvoiceLearner which
learns rules from user corrections.

Initial state: No knowledge of any invoice layouts.
Learning: When users correct extracted data, patterns are learned.
"""
import pdfplumber
import json
from typing import Optional, Dict, Any, Tuple, List
from pathlib import Path


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF file"""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text += page_text + "\n"
    return text


def extract_text_and_layout(pdf_path: str) -> Tuple[str, str]:
    """
    Extract text and layout information (word coordinates) from PDF.
    Returns: (full_text, layout_json_string)
    """
    text = ""
    all_words = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            page_text = page.extract_text() or ""
            text += page_text + "\n"
            
            # Extract words with coordinates
            words = page.extract_words(
                keep_blank_chars=False,
                x_tolerance=3,
                y_tolerance=3
            )
            
            # Add page number to words for multi-page support
            for w in words:
                w['page'] = i
                all_words.append(w)
                
    return text, json.dumps(all_words)


def get_pdf_info(pdf_path: str) -> Dict[str, Any]:
    """
    Get basic information about a PDF file.
    Used for debugging and analysis.
    """
    info = {
        'path': pdf_path,
        'filename': Path(pdf_path).name,
        'page_count': 0,
        'has_images': False,
        'image_count': 0,
    }
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            info['page_count'] = len(pdf.pages)
            
            for page in pdf.pages:
                if hasattr(page, 'images') and page.images:
                    info['has_images'] = True
                    info['image_count'] += len(page.images)
    except Exception as e:
        info['error'] = str(e)
    
    return info
