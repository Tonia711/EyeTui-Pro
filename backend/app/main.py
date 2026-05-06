from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func
import os
import re
import json
import hashlib
import math
import httpx
from pydantic import ValidationError
from pathlib import Path
from functools import lru_cache

# Disable model source check for faster OCR initialization
os.environ['DISABLE_MODEL_SOURCE_CHECK'] = 'True'

from .database import Base, engine, SessionLocal
from .models import Lens, Invoice, Company, Supplier, LensType, Site

from .schemas import (
    ReceivedLensCreate,
    ReceivedLensUpdate,
    ReceivedLensOut,
    ReceivedLensBulkCreate,
    ReceivedLensBulkResponse,
    
    LensStatusUpdate,
    BulkStatusUpdate,
    BulkStatusUpdateResponse,
    LensUsedUpdate,
    BulkUsedUpdate,
    BulkUsedUpdateResponse,

    InvoiceExtractedData,
    InvoiceExtractionResponse,
    ExcelExtractionResponse,
    ExcelExtractedRow,
    
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceOut,
    MoveToClinicRequest,
    
    InvoiceSaveRequest,
    InvoiceSaveResponse,
    InvoiceCheckExistsRequest,
    InvoiceCheckExistsResponse,
    InvoiceExtractedDataWithText,
    InvoiceExtractionResponseWithText,

    CompanyCreate,
    CompanyUpdate,
    CompanyOut,
    SupplierCreate,
    SupplierUpdate,
    SupplierOut,
    SiteCreate,
    SiteUpdate,
    SiteOut,
    LensTypeCreate,
    LensTypeUpdate,
    LensTypeOut,
    ChatAskRequest,
    ChatAskResponse,
    ChatSource,
    ChatIntentPayload,
    ChatQueryPlan,
)

from sqlalchemy.exc import IntegrityError
from .invoice_extractor import (
    extract_text_from_pdf,
    extract_text_and_layout, 
)
from .invoice_learner import get_learner
from .excel_processor import process_excel_file
import tempfile
import os
from datetime import date
from io import BytesIO

# Auto-detect and set library paths for pyzbar (cross-platform)
# This runs automatically when the module is imported
from .lib_path_helper import setup_library_paths
setup_library_paths()

try:
    from PIL import Image, ImageEnhance, ImageOps
    from pyzbar.pyzbar import decode as zbar_decode, ZBarSymbol
    _PYZBAR_AVAILABLE = True
    print("[INFO] pyzbar loaded successfully")
except Exception as e:
    # pyzbar or zbar may be missing at runtime; we'll guard the endpoint
    _PYZBAR_AVAILABLE = False
    print(f"[INFO] pyzbar not available: {e}")

try:
    from pylibdmtx.pylibdmtx import decode as dmtx_decode
    _PYLIBDMTX_AVAILABLE = True
except Exception as e:
    # pylibdmtx may be missing or libdmtx shared library not found
    # This is OK - we'll just skip Data Matrix decoding
    _PYLIBDMTX_AVAILABLE = False
    dmtx_decode = None
    print(f"[INFO] pylibdmtx not available (Data Matrix decoding disabled): {e}")

try:
    import cv2
    from cv2 import barcode
    _OPENCV_AVAILABLE = True
    _OPENCV_BARCODE_DETECTOR = None
    try:
        # Try to create OpenCV barcode detector (available in OpenCV 4.5.1+)
        _OPENCV_BARCODE_DETECTOR = barcode.BarcodeDetector()
        print("[INFO] OpenCV barcode detector initialized successfully")
    except Exception as e:
        print(f"[INFO] OpenCV barcode detector not available (using fallback): {e}")
        _OPENCV_BARCODE_DETECTOR = None
except Exception as e:
    _OPENCV_AVAILABLE = False
    _OPENCV_BARCODE_DETECTOR = None
    print(f"[INFO] OpenCV not available (barcode decoding disabled): {e}")

try:
    # Try pyrxing first (better performance, no system dependencies)
    import pyrxing
    _PYRXING_AVAILABLE = True
    _ZXING_CPP_AVAILABLE = False
    print("[INFO] pyrxing loaded successfully (fast, no system dependencies)")
except Exception as e:
    _PYRXING_AVAILABLE = False
    try:
        # Fallback to zxing-cpp (official binding)
        import zxing_cpp
        _ZXING_CPP_AVAILABLE = True
        print("[INFO] zxing-cpp loaded successfully")
    except Exception as e2:
        _ZXING_CPP_AVAILABLE = False
        print(f"[INFO] ZXing-C++ not available (pyrxing/zxing-cpp not installed): {e2}")


app = FastAPI(title="Lens MVP API")


# ------------------------
# Health Check Endpoint
# ------------------------
@app.get("/api/health")
def health_check():
    """Health check endpoint for Docker container health monitoring."""
    return {"status": "healthy"}


# Preload OCR engine on startup to avoid first-request delay
@app.on_event("startup")
async def startup_event():
    """Preload OCR engine to reduce first-request latency."""
    print("[STARTUP] Preloading OCR engine...")
    try:
        from .ocr_processor import _paddle_ocr, _PADDLEOCR_AVAILABLE
        if _PADDLEOCR_AVAILABLE and _paddle_ocr:
            # Trigger model loading with a small dummy image
            import numpy as np
            dummy_img = np.ones((100, 100, 3), dtype=np.uint8) * 255
            try:
                _paddle_ocr.predict(dummy_img)
                print("[STARTUP] OCR engine preloaded successfully")
            except:
                try:
                    _paddle_ocr.ocr(dummy_img, cls=True)
                    print("[STARTUP] OCR engine preloaded successfully (fallback method)")
                except Exception as e:
                    print(f"[STARTUP] OCR preload warning: {e}")
    except Exception as e:
        print(f"[STARTUP] OCR preload failed (will load on first request): {e}")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_or_create_company(db: Session, name: str | None) -> Company | None:
    if not name:
        return None
    clean_name = name.strip()
    if not clean_name:
        return None
    stmt = select(Company).where(func.lower(Company.name) == clean_name.lower())
    company = db.execute(stmt).scalar_one_or_none()
    if company:
        return company
    company = Company(name=clean_name)
    db.add(company)
    db.flush()
    return company


def get_or_create_supplier(db: Session, name: str | None) -> Supplier | None:
    if not name:
        return None
    clean_name = name.strip()
    if not clean_name:
        return None
    stmt = select(Supplier).where(func.lower(Supplier.name) == clean_name.lower())
    supplier = db.execute(stmt).scalar_one_or_none()
    if supplier:
        return supplier
    supplier = Supplier(name=clean_name)
    db.add(supplier)
    db.flush()
    return supplier


def get_or_create_type(
    db: Session,
    name: str | None,
    company: Company | None,
) -> LensType | None:
    if not name or not company:
        return None
    clean_name = name.strip()
    if not clean_name:
        return None
    stmt = select(LensType).where(
        func.lower(LensType.name) == clean_name.lower(),
        LensType.company_id == company.id,
    )
    lens_type = db.execute(stmt).scalar_one_or_none()
    if lens_type:
        return lens_type
    lens_type = LensType(name=clean_name, company_id=company.id)
    db.add(lens_type)
    db.flush()
    return lens_type


def get_or_create_site(db: Session, name: str | None) -> Site | None:
    if not name:
        return None
    clean_name = name.strip()
    if not clean_name:
        return None
    stmt = select(Site).where(func.lower(Site.name) == clean_name.lower())
    site = db.execute(stmt).scalar_one_or_none()
    if site:
        return site
    site = Site(name=clean_name)
    db.add(site)
    db.flush()
    return site


def resolve_type_id(
    db: Session,
    type_name: str | None,
    company_name: str | None,
) -> int | None:
    if not type_name:
        return None
    fallback_company = company_name or "Unknown"
    company = get_or_create_company(db, fallback_company)
    lens_type = get_or_create_type(db, type_name, company)
    return lens_type.id if lens_type else None


def resolve_site_id(db: Session, site_name: str | None) -> int | None:
    """
    Resolve an EXISTING clinic/site by name (case-insensitive).

    Clinics can ONLY be created via POST /site (Settings). Other flows (receive/inventory)
    must not auto-create clinics.
    """
    if not site_name:
        return None
    clean_name = site_name.strip()
    if not clean_name:
        return None
    stmt = select(Site).where(func.lower(Site.name) == clean_name.lower())
    site = db.execute(stmt).scalar_one_or_none()
    return site.id if site else None
# Create the database tables
# Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def classify_chat_intent(question: str) -> str:
    text = question.lower()

    invoice_keywords = ["invoice", "\u53d1\u7968"]
    inventory_keywords = ["inventory", "stock", "\u5e93\u5b58"]
    serial_keywords = ["serial", "serial number", "sn", "\u5e8f\u5217\u53f7"]
    product_keywords = ["product", "item", "\u4ea7\u54c1"]
    lens_keywords = ["lens", "\u93e3\u7247", "\u93e3\u7247\u4ea7\u54c1", "\u93e3\u7247\u5546\u54c1", "\u93e3\u7247\u5b57\u7b26", "\u93e3\u7247\u4f4d\u5143"]
    used_keywords = [
        "used",
        "consumed",
        "\u5df2\u4f7f\u7528",
        "\u5df2\u4f7f\u7528\u7684",
        "\u5df2\u7528",
        "\u5df2\u7528\u7684",
        "\u5df2\u7528\u7684\u93e3\u7247",
        "\u5df2\u7528\u93e3\u7247",
        "\u5df2\u6d3b\u7528",
        "\u6d88\u8017",
        "\u6d88\u8017\u7684",
        "\u6d88\u8017\u7684\u93e3\u7247",
        "\u5f02\u5e38\u5df2\u4f7f\u7528",
        "\u5f02\u5e38\u6d88\u8017",
    ]
    unmatched_keywords = [
        "unmatched",
        "not matched",
        "reconciliation",
        "mismatch",
        "problem",
        "issue",
        "abnormal",
        "\u5bf9\u8d26",
        "\u672a\u5339\u914d",
        "\u5339\u914d",
        "\u95ee\u9898",
        "\u6709\u95ee\u9898",
        "\u5f02\u5e38",
    ]
    supplier_keywords = [
        "supplier",
        "suppliers",
        "vendor",
        "vendors",
        "\u4f9b\u5e94\u5546",  # 供应商
    ]
    company_keywords = [
        "company",
        "companies",
        "manufacturer",
        "manufacturers",
        "\u516c\u53f8",  # 公司
    ]
    site_keywords = ["site", "sites", "clinic", "clinics", "location", "locations", "\u8bca\u6240"]
    existence_keywords = ["exist", "exists", "has", "have", "\u6709", "\u662f\u5426", "\u5b58\u5728"]

    if any(k in text for k in serial_keywords):
        # Serial + product/inventory/existence questions should query lens inventory first.
        if any(k in text for k in product_keywords + inventory_keywords + existence_keywords):
            return "inventory_item_lookup"
        # Serial questions mentioning invoice should go to invoice lookups.
        if any(k in text for k in invoice_keywords):
            return "invoice_detail"
        # Default serial lookup favors product existence in inventory.
        return "inventory_item_lookup"
    if any(k in text for k in unmatched_keywords):
        return "unmatched_summary"
    if ("\u95ee\u9898" in text or "\u5f02\u5e38" in text or "issue" in text or "problem" in text) and any(
        k in text for k in ["\u53d1\u7968", "invoice", "\u5bf9\u8d26", "reconciliation"]
    ):
        return "unmatched_summary"
    if any(k in text for k in invoice_keywords):
        return "invoice_detail"
    if any(k in text for k in used_keywords) and any(
        k in text for k in (lens_keywords + product_keywords)
    ):
        # Count used lenses: route to inventory overview, then focus parsing
        # will compute used number.
        return "inventory_overview"
    if any(k in text for k in supplier_keywords):
        return "supplier_overview"
    if any(k in text for k in company_keywords):
        return "company_overview"
    if any(k in text for k in site_keywords):
        return "site_overview"
    if any(k in text for k in inventory_keywords) or any(k in text for k in product_keywords):
        return "inventory_overview"
    return "unsupported"


def classify_chat_route(question: str) -> str:
    text = question.lower()
    if is_general_out_of_scope_question(question):
        return "out_of_scope"
    business_intent = classify_chat_intent(question)
    if business_intent != "unsupported":
        return "business_qa"

    doc_keywords = [
        "how",
        "what",
        "where",
        "why",
        "setup",
        "install",
        "run",
        "start",
        "error",
        "fix",
        "readme",
        "docs",
        "documentation",
        "system",
        "configuration",
        "deploy",
        "troubleshooting",
        "\u600e\u4e48",
        "\u5982\u4f55",
        "\u62a5\u9519",
        "\u542f\u52a8",
        "\u5b89\u88c5",
        "\u914d\u7f6e",
        "\u90e8\u7f72",
        "\u6587\u6863",
        "\u7cfb\u7edf",
    ]
    if any(keyword in text for keyword in doc_keywords):
        return "doc_qa"
    return "out_of_scope"


def is_general_out_of_scope_question(question: str) -> bool:
    """
    Hard guard for clearly non-system, general-world questions.
    Prevents doc_qa from answering unrelated topics such as weather/news.
    """
    text = question.lower()
    unrelated_markers = [
        # English
        "weather",
        "temperature",
        "forecast",
        "rain",
        "stock price",
        "bitcoin",
        "news",
        "sports",
        "movie",
        "recipe",
        "travel",
        "translate",
        "joke",
        # Chinese
        "天气",
        "气温",
        "下雨",
        "预报",
        "新闻",
        "股价",
        "比特币",
        "电影",
        "菜谱",
        "旅游",
        "翻译",
        "笑话",
    ]
    return any(marker in text for marker in unrelated_markers)


def prefers_english(question: str) -> bool:
    """
    Heuristic: if the user question contains mostly ASCII letters and no CJK,
    prefer English responses for template fallbacks.
    """
    if not question:
        return False
    has_cjk = any("\u4e00" <= ch <= "\u9fff" for ch in question)
    if has_cjk:
        return False
    letters = sum(1 for ch in question if ("a" <= ch.lower() <= "z"))
    return letters >= 4


def asks_used_lens_count(question: str) -> bool:
    text = question.lower()
    if not any(k in text for k in ["how many", "count", "number of", "多少"]):
        return False
    used_markers = ["used", "consumed", "\u5df2\u4f7f\u7528", "\u5df2\u7528", "\u6d88\u8017", "\u5df2\u6d3b\u7528"]
    lens_markers = ["lens", "\u93e3\u7247"]
    return any(m in text for m in used_markers) and any(m in text for m in lens_markers)


def extract_company_name_for_lens(question: str) -> str | None:
    """
    Extract a company/manufacturer name from patterns like:
      - \u6709\u591a\u5c11 lens \u6765\u81ea Alcon \u516c\u53f8\u7684
      - how many lenses from Alcon company
    """
    # Chinese "来自 XXX 公司" / "来自 XXX 的公司"
    m = re.search(r"\u6765\u81ea\s*([A-Za-z0-9\-_]+)\s*(?:\u516c\u53f8|\u5382\u5546|\u4f9b\u5e94\u5546)", question)
    if m:
        return m.group(1).strip()
    # Chinese "from XXX company" (rare)
    m = re.search(r"from\s*([A-Za-z0-9\-_]+)\s*(?:company|supplier|vendor)", question, flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return None


def asks_lens_count_from_company(question: str) -> bool:
    text = question.lower()
    if not any(k in text for k in ["how many", "count", "number of", "多少"]):
        return False
    if not any(k in text for k in ["lens", "\u93e3\u7247"]):
        return False
    if not any(k in text for k in ["\u6765\u81ea", "from"]):
        return False
    if not any(k in text for k in ["\u516c\u53f8", "company", "\u5382\u5546", "supplier", "vendor", "\u4f99\u5e94\u5546"]):
        # Keep it strict: avoid matching the plain "number of companies"
        return False
    return True


def detect_company_lens_focus(question: str) -> str:
    """
    Focus for company-lens count queries.
    Returns one of: all, in_stock, used, matched, unmatched.
    """
    text = question.lower()
    if any(k in text for k in ["in stock", "stock", "inventory", "在库", "库存"]):
        return "in_stock"
    if any(k in text for k in ["used", "已使用", "已用", "consumed", "消耗"]):
        return "used"
    if any(k in text for k in ["unmatched", "not matched", "未匹配"]):
        return "unmatched"
    if any(k in text for k in ["matched", "已匹配", "匹配"]):
        return "matched"
    return "all"


def extract_invoice_number(question: str) -> str | None:
    # Prefer numeric invoice IDs first (common in this system).
    # Use digit-only boundaries instead of \b to avoid Unicode word-boundary issues
    # when digits are adjacent to Chinese characters.
    numeric_matches = re.findall(r"(?<!\d)\d{6,}(?!\d)", question)
    if numeric_matches:
        return numeric_matches[0]

    # Fallback: allow alphanumeric invoice pattern.
    mixed_matches = re.findall(r"(?<![A-Za-z0-9-])[A-Za-z0-9-]{6,}(?![A-Za-z0-9-])", question)
    for candidate in mixed_matches:
        # Guardrail: treat only tokens containing at least one digit as IDs.
        # This prevents plain words like "invoice" from being misclassified as an invoice number.
        if any(ch.isdigit() for ch in candidate):
            return candidate
    return None


def is_serial_lookup_question(question: str) -> bool:
    text = question.lower()
    serial_markers = [
        "serial",
        "serial number",
        "sn",
        "\u5e8f\u5217\u53f7",  # 序列号
    ]
    return any(marker in text for marker in serial_markers)


def detect_inventory_focus(question: str) -> str:
    text = question.lower()
    if any(k in text for k in ["used", "\u5df2\u4f7f\u7528"]):
        return "used"
    if any(k in text for k in ["unmatched", "not matched", "\u672a\u5339\u914d"]):
        return "unmatched"
    if any(k in text for k in ["matched", "\u5df2\u5339\u914d", "\u5339\u914d"]):
        return "matched"
    if any(k in text for k in ["in stock", "stock", "inventory", "\u5e93\u5b58", "\u5728\u5e93"]):
        return "in_stock"
    return "overview"


def asks_invoice_count_question(question: str) -> bool:
    text = question.lower()
    invoice_markers = ["invoice", "\u53d1\u7968"]
    count_markers = [
        "how many",
        "count",
        "number of",
        "\u591a\u5c11",
        "\u51e0\u4e2a",
        "\u6570\u91cf",
        "\u603b\u6570",
    ]
    detail_markers = ["which", "detail", "\u8be6\u60c5", "\u54ea\u4e2a", "\u54ea\u4e9b", "\u5217\u51fa"]
    return (
        any(k in text for k in invoice_markers)
        and any(k in text for k in count_markers)
        and not any(k in text for k in detail_markers)
    )


def asks_for_problem_invoice_list(question: str) -> bool:
    """
    Detect whether user asks for problematic invoice examples/list.
    """
    text = question.lower()
    list_markers = [
        "which",
        "what",
        "list",
        "show",
        "\u5177\u4f53",
        "\u54ea\u4e9b",
        "\u54ea\u4e2a",
        "\u5217\u51fa",
    ]
    problem_markers = [
        "problem",
        "issue",
        "abnormal",
        "unmatched",
        "mismatch",
        "not matched",
        "\u6709\u95ee\u9898",
        "\u95ee\u9898",
        "\u5f02\u5e38",
        "\u672a\u5339\u914d",
        "\u5bf9\u8d26",
    ]
    invoice_markers = ["invoice", "\u53d1\u7968"]
    return (
        any(k in text for k in invoice_markers)
        and any(k in text for k in problem_markers)
        and any(k in text for k in list_markers)
    )


def parse_intent_with_llm(question: str) -> ChatIntentPayload | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("CHATBOT_INTENT_MODEL", "gpt-4o-mini")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

    system_prompt = (
        "You are a router and intent parser for an inventory/invoice/reconciliation system. "
        "Return JSON only with keys: route, intent, invoice_number, doc_search_terms. "
        "Valid route values are: business_qa, doc_qa, out_of_scope. "
        "Valid intent values are: inventory_overview, inventory_item_lookup, invoice_detail, unmatched_summary, supplier_overview, company_overview, site_overview, unsupported. "
        "Use business_qa only for inventory, invoice, reconciliation status questions. "
        "Use doc_qa for system usage, setup, troubleshooting, workflow, and documentation questions. "
        "Use out_of_scope for unrelated questions. "
        "Only set invoice_number when intent is invoice_detail and a likely invoice number exists. "
        "For doc_qa, provide 2-6 short English search terms in doc_search_terms."
    )
    user_prompt = f"Question: {question}"

    payload = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            response = client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return ChatIntentPayload.model_validate(parsed)
    except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError):
        return None


def parse_query_plan_with_llm(question: str) -> ChatQueryPlan | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    model = os.getenv("CHATBOT_QUERY_PLAN_MODEL", os.getenv("CHATBOT_INTENT_MODEL", "gpt-4o-mini"))
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    system_prompt = (
        "You are a query planner for an inventory/invoice/reconciliation system. "
        "Return JSON only with keys: route, entity, operation, serial_number, invoice_number. "
        "Valid route: business_qa, doc_qa, out_of_scope. "
        "Valid entity: lens, invoice, supplier, company, site, reconciliation. "
        "Valid operation: overview, count, exists, detail, summary. "
        "Use business_qa only when a database-backed answer is needed. "
        "If the user asks system usage/setup/troubleshooting docs questions, return route=doc_qa. "
        "Do not invent serial_number or invoice_number."
    )
    payload = {
        "model": model,
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Question: {question}"},
        ],
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            response = client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return ChatQueryPlan.model_validate(parsed)
    except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError):
        return None


def resolve_chat_intent(question: str) -> ChatIntentPayload:
    llm_intent = parse_intent_with_llm(question)
    if llm_intent:
        if llm_intent.route == "business_qa" and not llm_intent.intent:
            llm_intent.intent = classify_chat_intent(question)
        if llm_intent.intent == "invoice_detail" and not llm_intent.invoice_number:
            llm_intent.invoice_number = extract_invoice_number(question)
        return llm_intent

    fallback_intent = classify_chat_intent(question)
    fallback_route = classify_chat_route(question)
    return ChatIntentPayload(
        route=fallback_route,
        intent=fallback_intent if fallback_route == "business_qa" else None,
        invoice_number=extract_invoice_number(question) if fallback_intent == "invoice_detail" else None,
        doc_search_terms=[],
    )


def build_query_plan_from_intent(payload: ChatIntentPayload, question: str) -> ChatQueryPlan:
    if payload.route != "business_qa":
        return ChatQueryPlan(route=payload.route)

    if asks_invoice_count_question(question):
        return ChatQueryPlan(route="business_qa", entity="invoice", operation="count")

    intent = payload.intent or "unsupported"
    serial_in_question = extract_invoice_number(question) if is_serial_lookup_question(question) else None

    if intent == "inventory_overview":
        return ChatQueryPlan(route="business_qa", entity="lens", operation="overview")
    if intent == "inventory_item_lookup":
        return ChatQueryPlan(
            route="business_qa",
            entity="lens",
            operation="exists",
            serial_number=serial_in_question or extract_invoice_number(question),
        )
    if intent == "invoice_detail":
        if is_serial_lookup_question(question):
            return ChatQueryPlan(
                route="business_qa",
                entity="invoice",
                operation="detail",
                serial_number=serial_in_question or payload.invoice_number,
            )
        return ChatQueryPlan(
            route="business_qa",
            entity="invoice",
            operation="detail",
            invoice_number=payload.invoice_number or extract_invoice_number(question),
        )
    if intent == "unmatched_summary":
        return ChatQueryPlan(route="business_qa", entity="reconciliation", operation="summary")
    if intent == "supplier_overview":
        return ChatQueryPlan(route="business_qa", entity="supplier", operation="count")
    if intent == "company_overview":
        return ChatQueryPlan(route="business_qa", entity="company", operation="count")
    if intent == "site_overview":
        return ChatQueryPlan(route="business_qa", entity="site", operation="count")

    return ChatQueryPlan(route="business_qa")


def normalize_query_plan(plan: ChatQueryPlan, question: str) -> ChatQueryPlan:
    """
    Fill missing filter fields from the original question to keep LLM plans robust.
    """
    if plan.route != "business_qa":
        return plan

    extracted_number = extract_invoice_number(question)
    if plan.entity == "lens" and plan.operation == "exists" and not plan.serial_number:
        plan.serial_number = extracted_number
    if plan.entity == "invoice" and plan.operation == "detail":
        if is_serial_lookup_question(question):
            plan.serial_number = plan.serial_number or extracted_number
            plan.invoice_number = None
        else:
            plan.invoice_number = plan.invoice_number or extracted_number
    return plan


def execute_business_query_plan(plan: ChatQueryPlan, db: Session, question: str) -> ChatAskResponse | None:
    if plan.route != "business_qa" or not plan.entity or not plan.operation:
        return None

    plan_intent = f"{plan.entity}_{plan.operation}"

    if plan.entity == "supplier" and plan.operation == "count":
        total_suppliers = db.execute(select(func.count(Supplier.id))).scalar_one()
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=f"There are {total_suppliers} suppliers in the system.",
            data={"total_suppliers": total_suppliers},
            sources=[ChatSource(source_type="table", source_value="supplier")],
        )

    if plan.entity == "company" and plan.operation == "count":
        total_companies = db.execute(select(func.count(Company.id))).scalar_one()
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=f"There are {total_companies} companies in the system.",
            data={"total_companies": total_companies},
            sources=[ChatSource(source_type="table", source_value="company")],
        )

    if plan.entity == "site" and plan.operation == "count":
        total_sites = db.execute(select(func.count(Site.id))).scalar_one()
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=f"There are {total_sites} sites in the system.",
            data={"total_sites": total_sites},
            sources=[ChatSource(source_type="table", source_value="site")],
        )

    if plan.entity == "invoice" and plan.operation == "count":
        total_invoice_rows = db.execute(select(func.count(Invoice.id))).scalar_one()
        total_invoice_numbers = db.execute(
            select(func.count(func.distinct(Invoice.invoice_number)))
        ).scalar_one()
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=(
                f"There are {total_invoice_numbers} invoice numbers in the system "
                f"({total_invoice_rows} invoice rows in total)."
            ),
            data={
                "total_invoice_numbers": total_invoice_numbers,
                "total_invoice_rows": total_invoice_rows,
            },
            sources=[ChatSource(source_type="table", source_value="invoice")],
        )

    if plan.entity == "lens" and plan.operation == "exists":
        if not plan.serial_number:
            return ChatAskResponse(
                route="business_qa",
                intent=plan_intent,
                answer="Please provide a serial number.",
                data={},
                sources=[ChatSource(source_type="hint", source_value="missing_serial_number")],
            )
        lens = db.execute(select(Lens).where(Lens.serial_number == plan.serial_number)).scalar_one_or_none()
        if not lens:
            return ChatAskResponse(
                route="business_qa",
                intent=plan_intent,
                answer=f"No product found with serial number {plan.serial_number}.",
                data={"serial_number": plan.serial_number, "exists": False},
                sources=[ChatSource(source_type="table", source_value="lens")],
            )
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=f"Yes, product with serial number {plan.serial_number} exists.",
            data={
                "serial_number": plan.serial_number,
                "exists": True,
                "is_used": lens.is_used,
                "is_matched": lens.is_matched,
                "type": lens.type,
                "company": lens.company,
                "site": lens.site,
            },
            sources=[ChatSource(source_type="table", source_value="lens")],
        )

    if plan.entity == "invoice" and plan.operation == "detail":
        if not plan.invoice_number and not plan.serial_number:
            matched_invoice_rows = db.execute(
                select(func.count(Invoice.id))
                .select_from(Invoice)
                .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
                .where(Lens.is_matched.is_(True))
            ).scalar_one()
            unmatched_invoice_rows = db.execute(
                select(func.count(Invoice.id))
                .select_from(Invoice)
                .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
                .where((Lens.id.is_(None)) | (Lens.is_matched.is_(False)))
            ).scalar_one()
            matched_invoice_numbers = db.execute(
                select(func.count(func.distinct(Invoice.invoice_number)))
                .select_from(Invoice)
                .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
                .where(Lens.is_matched.is_(True))
            ).scalar_one()
            unmatched_invoice_numbers = db.execute(
                select(func.count(func.distinct(Invoice.invoice_number)))
                .select_from(Invoice)
                .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
                .where((Lens.id.is_(None)) | (Lens.is_matched.is_(False)))
            ).scalar_one()
            matched_product_rows = db.execute(
                select(Lens.serial_number)
                .where(Lens.is_matched.is_(True))
                .order_by(Lens.id.desc())
                .limit(10)
            ).all()
            return ChatAskResponse(
                route="business_qa",
                intent="invoice_match_summary",
                answer=(
                    f"Matched invoice rows: {matched_invoice_rows}. Unmatched invoice rows: {unmatched_invoice_rows}. "
                    f"Matched invoice numbers: {matched_invoice_numbers}. Unmatched invoice numbers: {unmatched_invoice_numbers}."
                ),
                data={
                    "matched_invoice_rows": matched_invoice_rows,
                    "unmatched_invoice_rows": unmatched_invoice_rows,
                    "matched_invoice_numbers": matched_invoice_numbers,
                    "unmatched_invoice_numbers": unmatched_invoice_numbers,
                    "sample_matched_product_serial_numbers": [
                        row.serial_number for row in matched_product_rows
                    ],
                },
                sources=[
                    ChatSource(source_type="table", source_value="invoice"),
                    ChatSource(source_type="table", source_value="lens"),
                ],
            )
        if plan.serial_number:
            stmt = (
                select(
                    Invoice.invoice_number,
                    Supplier.name.label("supplier_name"),
                    Invoice.serial_number,
                    Lens.is_matched,
                )
                .select_from(Invoice)
                .join(Supplier, Invoice.supplier_id == Supplier.id, isouter=True)
                .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
                .where(Invoice.serial_number == plan.serial_number)
                .order_by(Invoice.id.asc())
            )
            lookup_value = plan.serial_number
            lookup_by_serial = True
        else:
            stmt = (
                select(
                    Invoice.invoice_number,
                    Supplier.name.label("supplier_name"),
                    Invoice.serial_number,
                    Lens.is_matched,
                )
                .select_from(Invoice)
                .join(Supplier, Invoice.supplier_id == Supplier.id, isouter=True)
                .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
                .where(Invoice.invoice_number == plan.invoice_number)
                .order_by(Invoice.id.asc())
            )
            lookup_value = plan.invoice_number or ""
            lookup_by_serial = False
        rows = db.execute(stmt).all()
        if not rows:
            if lookup_by_serial:
                not_found_answer = f"No invoice records found for serial number {lookup_value}."
                not_found_data = {"serial_number": lookup_value, "items": []}
            else:
                not_found_answer = f"No records found for invoice number {lookup_value}."
                not_found_data = {"invoice_number": lookup_value, "items": []}
            return ChatAskResponse(
                route="business_qa",
                intent=plan_intent,
                answer=not_found_answer,
                data=not_found_data,
                sources=[ChatSource(source_type="table", source_value="invoice")],
            )

        supplier_name = rows[0].supplier_name or "Unknown"
        invoice_number = rows[0].invoice_number
        items = [{"serial_number": r.serial_number, "is_matched": bool(r.is_matched)} for r in rows]
        unmatched_count = sum(1 for item in items if not item["is_matched"])
        if lookup_by_serial:
            answer = (
                f"Serial number {lookup_value} is linked to invoice {invoice_number} from supplier {supplier_name}. "
                f"Matched status: {'matched' if unmatched_count == 0 else 'partially unmatched'}."
            )
        else:
            answer = (
                f"Invoice {invoice_number} is from supplier {supplier_name}. It contains {len(items)} serial numbers, "
                f"with {unmatched_count} unmatched."
            )
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=answer,
            data={
                "invoice_number": invoice_number,
                "supplier_name": supplier_name,
                "item_count": len(items),
                "unmatched_count": unmatched_count,
                "items": items,
            },
            sources=[
                ChatSource(source_type="table", source_value="invoice"),
                ChatSource(source_type="table", source_value="lens"),
                ChatSource(source_type="table", source_value="supplier"),
            ],
        )

    if plan.entity == "lens" and plan.operation == "overview":
        total = db.execute(select(func.count(Lens.id))).scalar_one()
        used = db.execute(select(func.count(Lens.id)).where(Lens.is_used.is_(True))).scalar_one()
        matched = db.execute(select(func.count(Lens.id)).where(Lens.is_matched.is_(True))).scalar_one()
        unmatched = total - matched
        in_stock = total - used
        focus = detect_inventory_focus(question)
        by_site_rows = db.execute(
            select(Site.name, func.count(Lens.id))
            .select_from(Lens)
            .join(Site, Lens.site_id == Site.id, isouter=True)
            .group_by(Site.name)
            .order_by(func.count(Lens.id).desc())
        ).all()
        by_site = [{"site": row[0] or "Unknown", "count": row[1]} for row in by_site_rows]
        if focus == "used":
            answer = (
                f"There are currently {used} used products. "
                f"Inventory view: {in_stock} in stock, {total} total."
            )
        elif focus == "matched":
            answer = (
                f"There are currently {matched} matched products. "
                f"Inventory view: {in_stock} in stock, {used} used, {total} total."
            )
        elif focus == "unmatched":
            answer = (
                f"There are currently {unmatched} unmatched products. "
                f"Inventory view: {in_stock} in stock, {used} used, {total} total."
            )
        else:
            answer = (
                f"There are currently {in_stock} products in stock. "
                f"Across all records: {total} total, {used} used. "
                f"Reconciliation status: {matched} matched, {unmatched} unmatched."
            )
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=answer,
            data={
                "in_stock_products": in_stock,
                "total_lenses": total,
                "used_lenses": used,
                "matched_lenses": matched,
                "unmatched_lenses": unmatched,
                "by_site": by_site,
            },
            sources=[
                ChatSource(source_type="table", source_value="lens"),
                ChatSource(source_type="table", source_value="site"),
            ],
        )

    if plan.entity == "reconciliation" and plan.operation == "summary":
        unmatched_lens_rows = db.execute(
            select(Lens.serial_number).where(Lens.is_matched.is_(False)).order_by(Lens.id.desc()).limit(10)
        ).all()
        unmatched_invoice_rows = db.execute(
            select(Invoice.invoice_number, Invoice.serial_number)
            .select_from(Invoice)
            .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
            .where((Lens.id.is_(None)) | (Lens.is_matched.is_(False)))
            .order_by(Invoice.id.desc())
            .limit(10)
        ).all()
        unmatched_invoice_number_rows = db.execute(
            select(Invoice.invoice_number)
            .select_from(Invoice)
            .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
            .where((Lens.id.is_(None)) | (Lens.is_matched.is_(False)))
            .group_by(Invoice.invoice_number)
            .order_by(func.max(Invoice.id).desc())
        ).all()
        total_unmatched_lens = db.execute(select(func.count(Lens.id)).where(Lens.is_matched.is_(False))).scalar_one()
        total_unmatched_invoice_rows = db.execute(
            select(func.count(Invoice.id))
            .select_from(Invoice)
            .join(Lens, Invoice.serial_number == Lens.serial_number, isouter=True)
            .where((Lens.id.is_(None)) | (Lens.is_matched.is_(False)))
        ).scalar_one()
        sample_unmatched_invoice_numbers = [
            row.invoice_number
            for row in unmatched_invoice_number_rows
            if row.invoice_number
        ]
        if asks_for_problem_invoice_list(question):
            if sample_unmatched_invoice_numbers:
                preview = ", ".join(sample_unmatched_invoice_numbers)
                answer = (
                    f"Problematic invoice numbers: {preview}. "
                    f"Total unmatched invoice rows: {total_unmatched_invoice_rows}."
                )
            else:
                answer = f"No problematic invoices found. Unmatched invoice rows: {total_unmatched_invoice_rows}."
        else:
            answer = f"Unmatched lenses: {total_unmatched_lens}. Unmatched invoice rows: {total_unmatched_invoice_rows}."
        return ChatAskResponse(
            route="business_qa",
            intent=plan_intent,
            answer=answer,
            data={
                "total_unmatched_lenses": total_unmatched_lens,
                "total_unmatched_invoice_rows": total_unmatched_invoice_rows,
                "sample_unmatched_invoice_numbers": sample_unmatched_invoice_numbers,
                "sample_unmatched_lens_serial_numbers": [r.serial_number for r in unmatched_lens_rows],
                "sample_unmatched_invoice_rows": [
                    {"invoice_number": r.invoice_number, "serial_number": r.serial_number}
                    for r in unmatched_invoice_rows
                ],
            },
            sources=[
                ChatSource(source_type="table", source_value="lens"),
                ChatSource(source_type="table", source_value="invoice"),
            ],
        )

    return None


@lru_cache(maxsize=1)
def load_doc_chunks() -> list[dict]:
    project_root = Path(__file__).resolve().parents[2]
    candidate_paths = [
        project_root / "README.md",
        project_root / "backend" / "README.md",
        project_root / "TESTING_GUIDE.md",
    ]
    docs_dir = project_root / "docs"
    if docs_dir.exists():
        candidate_paths.extend(sorted(docs_dir.glob("*.md")))

    chunks: list[dict] = []
    for path in candidate_paths:
        if not path.exists():
            continue
        raw_text = path.read_text(encoding="utf-8", errors="ignore")
        sections = re.split(r"\n\s*\n", raw_text)
        current = ""
        chunk_index = 0
        for section in sections:
            content = section.strip()
            if not content:
                continue
            next_chunk = f"{current}\n\n{content}".strip() if current else content
            if len(next_chunk) <= 900:
                current = next_chunk
                continue
            if current:
                chunks.append(
                    {
                        "path": str(path.relative_to(project_root)),
                        "content": current,
                        "index": chunk_index,
                    }
                )
                chunk_index += 1
            current = content
        if current:
            chunks.append(
                {
                    "path": str(path.relative_to(project_root)),
                    "content": current,
                    "index": chunk_index,
                }
            )
    return chunks


def tokenize_for_search(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) >= 2
    }


def expand_query_text_for_cn(text: str) -> str:
    """
    Keep UI/response English while allowing Chinese queries to map to
    searchable English terms for local doc retrieval.
    """
    expansions = {
        "\u53d1\u7968": "invoice",
        "\u5e93\u5b58": "inventory stock",
        "\u5bf9\u8d26": "reconciliation",
        "\u672a\u5339\u914d": "unmatched",
        "\u5339\u914d": "matched",
        "\u63a5\u6536": "receive receiving intake upload scan",
        "\u63a5\u6536lens": "lens receiving intake upload scan",
        "\u955c\u7247": "lens iol product",
        "\u600e\u4e48": "how steps guide",
        "\u5982\u4f55": "how steps guide",
        "\u6b65\u9aa4": "steps guide workflow",
        "\u4f9b\u5e94\u5546": "supplier vendor",
        "\u516c\u53f8": "company manufacturer",
        "\u8bca\u6240": "clinic site",
        "\u542f\u52a8": "start run",
        "\u5b89\u88c5": "install setup",
        "\u62a5\u9519": "error fix troubleshooting",
        "\u6587\u6863": "documentation readme docs",
        "\u7cfb\u7edf": "system",
    }
    enriched = text
    lowered = text.lower()
    for cn_term, en_terms in expansions.items():
        if cn_term in lowered:
            enriched = f"{enriched} {en_terms}"
    return enriched


def retrieve_doc_chunks(question: str, search_terms: list[str], limit: int = 4) -> list[dict]:
    query_text = " ".join(search_terms).strip() or question
    query_text = expand_query_text_for_cn(query_text)

    # 1) semantic retrieval first (embedding-based), if configured
    semantic_chunks = retrieve_doc_chunks_by_embedding(query_text, limit=max(limit, 8))

    # 2) lexical retrieval as stable fallback
    lexical_chunks = retrieve_doc_chunks_by_keyword(query_text, limit=max(limit, 8))

    # 3) merge while preserving ranking priority (semantic first)
    merged: list[dict] = []
    seen: set[tuple[str, int]] = set()
    for chunk in semantic_chunks + lexical_chunks:
        key = (chunk["path"], chunk["index"])
        if key in seen:
            continue
        seen.add(key)
        merged.append(chunk)
        if len(merged) >= limit:
            break
    return merged


def should_use_doc_embeddings() -> bool:
    raw = os.getenv("CHATBOT_DOC_EMBEDDING_ENABLED", "true").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def get_doc_embedding_model() -> str:
    return os.getenv("CHATBOT_DOC_EMBEDDING_MODEL", "text-embedding-3-small").strip()


def get_doc_embedding_cache_path() -> Path:
    project_root = Path(__file__).resolve().parents[2]
    default_path = project_root / "backend" / ".rag" / "doc_embeddings_cache.json"
    configured = os.getenv("CHATBOT_DOC_EMBED_CACHE_PATH", "").strip()
    return Path(configured) if configured else default_path


def build_doc_corpus_fingerprint(chunks: list[dict], model: str) -> str:
    digest = hashlib.sha256()
    digest.update(model.encode("utf-8"))
    for chunk in chunks:
        digest.update(chunk["path"].encode("utf-8"))
        digest.update(str(chunk["index"]).encode("utf-8"))
        digest.update(chunk["content"].encode("utf-8"))
    return digest.hexdigest()


def embed_texts_with_openai(texts: list[str], model: str) -> list[list[float]] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not texts:
        return None
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    payload = {"model": model, "input": texts}
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            data = response.json().get("data", [])
            vectors = [item["embedding"] for item in data]
            if len(vectors) != len(texts):
                return None
            return vectors
    except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


@lru_cache(maxsize=1)
def load_doc_vector_index() -> dict | None:
    if not should_use_doc_embeddings():
        return None
    if not os.getenv("OPENAI_API_KEY"):
        return None

    chunks = load_doc_chunks()
    if not chunks:
        return None

    model = get_doc_embedding_model()
    fingerprint = build_doc_corpus_fingerprint(chunks, model)
    cache_path = get_doc_embedding_cache_path()

    cached_vectors: list[list[float]] | None = None
    if cache_path.exists():
        try:
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if (
                cached.get("fingerprint") == fingerprint
                and cached.get("model") == model
                and isinstance(cached.get("vectors"), list)
                and len(cached.get("vectors", [])) == len(chunks)
            ):
                cached_vectors = cached["vectors"]
        except (OSError, json.JSONDecodeError, TypeError, ValueError):
            cached_vectors = None

    if cached_vectors is None:
        texts = [expand_query_text_for_cn(chunk["content"]) for chunk in chunks]
        embedded = embed_texts_with_openai(texts, model)
        if not embedded:
            return None
        cached_vectors = embedded
        try:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(
                json.dumps(
                    {
                        "fingerprint": fingerprint,
                        "model": model,
                        "vectors": cached_vectors,
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
        except OSError:
            # Cache write failure should not break retrieval.
            pass

    return {"chunks": chunks, "vectors": cached_vectors, "model": model}


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return -1.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for a, b in zip(vec_a, vec_b):
        dot += a * b
        norm_a += a * a
        norm_b += b * b
    denom = math.sqrt(norm_a) * math.sqrt(norm_b)
    if denom <= 0:
        return -1.0
    return dot / denom


def retrieve_doc_chunks_by_embedding(query_text: str, limit: int = 8) -> list[dict]:
    index = load_doc_vector_index()
    if index is None:
        return []

    query_vectors = embed_texts_with_openai([query_text], index["model"])
    if not query_vectors:
        return []

    query_vec = query_vectors[0]
    scored: list[tuple[float, dict]] = []
    for chunk, vec in zip(index["chunks"], index["vectors"]):
        score = cosine_similarity(query_vec, vec)
        if score <= 0:
            continue
        scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored[:limit]]


def retrieve_doc_chunks_by_keyword(query_text: str, limit: int = 8) -> list[dict]:
    query_tokens = tokenize_for_search(query_text)
    if not query_tokens:
        return []

    query_lower = query_text.lower()
    asks_how = any(k in query_lower for k in ["how", "steps", "guide", "workflow", "\u5982\u4f55", "\u600e\u4e48", "\u6b65\u9aa4"])
    asks_receive = any(k in query_lower for k in ["receive", "receiving", "scan", "upload", "intake", "\u63a5\u6536"])

    scored_chunks: list[tuple[int, dict]] = []
    for chunk in load_doc_chunks():
        content_lower = chunk["content"].lower()
        path_lower = chunk["path"].lower()
        chunk_tokens = tokenize_for_search(chunk["content"])
        overlap = query_tokens & chunk_tokens
        if not overlap:
            continue
        score = len(overlap)
        if path_lower.endswith("readme.md"):
            score += 1
        # Prefer user-guidance documents for "how to" questions.
        if asks_how and ("onboarding" in path_lower or "quick_tasks" in path_lower):
            score += 6
        if asks_receive and any(k in content_lower for k in ["receive", "receiving", "scan", "upload"]):
            score += 4
        if asks_receive and ("onboarding" in path_lower or "quick_tasks" in path_lower):
            score += 4
        scored_chunks.append((score, chunk))

    scored_chunks.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored_chunks[:limit]]


def build_doc_answer_without_llm(question: str, doc_chunks: list[dict]) -> str:
    if not doc_chunks:
        return "I could not find enough evidence in the system documentation to answer this question."

    question_lower = question.lower()
    asks_how = any(k in question_lower for k in ["how", "steps", "guide", "workflow", "如何", "怎么", "步骤"])
    asks_receive = any(k in question_lower for k in ["receive", "receiving", "lens receiving", "接收", "镜片"])
    asks_onboarding = any(k in question_lower for k in ["new user", "onboarding", "start using", "开始使用", "新用户"])
    asks_system_usage = any(k in question_lower for k in ["系统怎么使用", "如何使用系统", "怎么使用系统", "system usage", "how to use the system"])
    use_en = prefers_english(question)

    # Task-oriented fallback templates for common onboarding questions.
    if asks_how and asks_receive:
        if use_en:
            return (
                "Recommended steps to receive lenses:\n"
                "1) Open the Lens Receiving page.\n"
                "2) Select the correct clinic/site.\n"
                "3) Scan barcodes or upload an Excel file to record serial numbers.\n"
                "4) Review and confirm the save was successful.\n"
                "5) If recognition fails, use Learning Mode or add missing company/lens type in Settings first."
            )
        return (
            "接收镜片的推荐步骤是："
            "1) 打开 Lens Receiving 页面；"
            "2) 先选择正确的 clinic/site；"
            "3) 使用扫码或 Excel 上传录入 serial number；"
            "4) 检查并确认保存成功；"
            "5) 若识别失败，使用 Learning Mode 或先在 Settings 补充 company/lens type。"
        )
    if asks_how and (asks_onboarding or asks_system_usage):
        if use_en:
            return (
                "A good onboarding order for new users:\n"
                "1) In Settings, check and complete supplier/company/lens type/site.\n"
                "2) Use Lens Receiving to register newly arrived lenses.\n"
                "3) Use Lens Usage & Invoice Reconciliation to upload usage records and invoices, then reconcile.\n"
                "4) Use Invoice List and Lens Inventory to review unmatched items and inventory status."
            )
        return (
            "新用户建议按这个顺序开始："
            "1) 先在 Settings 检查并补齐 supplier/company/lens type/site；"
            "2) 到 Lens Receiving 录入新到镜片；"
            "3) 到 Lens Usage & Invoice Reconciliation 上传使用记录和发票并对账；"
            "4) 在 Invoice List 和 Lens Inventory 复核未匹配项与库存状态。"
        )

    query_tokens = tokenize_for_search(expand_query_text_for_cn(question))
    selected_lines: list[str] = []
    for chunk in doc_chunks:
        for raw_line in chunk["content"].splitlines():
            line = raw_line.strip()
            if not line:
                continue
            # Skip markdown headings and list titles; they are often not actionable.
            if line.startswith("#") or line.lower().startswith("task:"):
                continue
            if len(line) < 20:
                continue
            line_tokens = tokenize_for_search(line)
            if query_tokens and not (query_tokens & line_tokens):
                continue
            # Prefer actionable instructions over high-level descriptions.
            action_markers = [
                "open", "go to", "select", "upload", "scan", "check", "verify",
                "save", "add", "retry", "打开", "进入", "选择", "上传", "扫码", "检查", "确认", "保存", "新增",
            ]
            if asks_how and not any(marker in line.lower() for marker in action_markers):
                continue
            cleaned = re.sub(r"[*_`#>\[\]\(\)]", "", line).strip()
            cleaned = re.sub(r"\s{2,}", " ", cleaned)
            if not cleaned:
                continue
            if cleaned not in selected_lines:
                selected_lines.append(cleaned)
            if len(selected_lines) >= 3:
                break
        if len(selected_lines) >= 3:
            break

    if not selected_lines:
        top_chunk = doc_chunks[0]
        snippet = re.sub(r"\s+", " ", top_chunk["content"]).strip()[:260].rstrip()
        return (
            "I found relevant information in the system documentation. "
            f"Based on `{top_chunk['path']}`, {snippet}"
            f"{'...' if len(top_chunk['content']) > 260 else ''}"
        )

    steps = " ".join(f"{idx + 1}) {line}" for idx, line in enumerate(selected_lines))
    return f"Based on system documentation, here are the key steps: {steps}"


def generate_doc_answer_with_llm(question: str, doc_chunks: list[dict]) -> str | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not doc_chunks:
        return None

    model = os.getenv("CHATBOT_DOC_MODEL", os.getenv("CHATBOT_INTENT_MODEL", "gpt-4o-mini"))
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")

    context = "\n\n".join(
        f"[Source: {chunk['path']}]\n{chunk['content']}"
        for chunk in doc_chunks
    )
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You answer questions about this software system using only the provided documentation context. "
                    "Answer in English. "
                    "If the context is insufficient, say you cannot confirm from the documentation. "
                    "Do not mention any information not present in the context."
                ),
            },
            {
                "role": "user",
                "content": f"Question:\n{question}\n\nDocumentation context:\n{context}",
            },
        ],
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            return body["choices"][0]["message"]["content"].strip()
    except (httpx.HTTPError, KeyError, json.JSONDecodeError):
        return None


def should_use_safe_nlg() -> bool:
    raw = os.getenv("CHATBOT_SAFE_NLG_ENABLED", "false").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def build_safe_nlg_facts(response: ChatAskResponse) -> dict:
    """
    Build a sanitized fact payload for answer naturalization.
    This payload excludes raw identifiers and detailed row-level content.
    """
    allowed_metric_keys = {
        "in_stock_products",
        "total_lenses",
        "used_lenses",
        "matched_lenses",
        "unmatched_lenses",
        "total_suppliers",
        "total_companies",
        "total_sites",
        "matched_invoice_rows",
        "unmatched_invoice_rows",
        "matched_invoice_numbers",
        "unmatched_invoice_numbers",
        "total_unmatched_lenses",
        "total_unmatched_invoice_rows",
        "exists",
        "is_used",
        "is_matched",
        "item_count",
        "unmatched_count",
    }
    safe_data: dict = {}
    for key in allowed_metric_keys:
        if key in response.data:
            safe_data[key] = response.data[key]
    return {
        "intent": response.intent,
        "route": response.route,
        "metrics": safe_data,
    }


def generate_safe_natural_business_answer(
    question: str,
    response: ChatAskResponse,
) -> ChatAskResponse:
    """
    Optional natural-language layer for business answers.
    Only sends sanitized aggregate facts to the LLM.
    """
    if not should_use_safe_nlg():
        return response

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return response

    safe_facts = build_safe_nlg_facts(response)
    if not safe_facts.get("metrics"):
        return response

    model = os.getenv("CHATBOT_ANSWER_MODEL", os.getenv("CHATBOT_QUERY_PLAN_MODEL", "gpt-4o-mini"))
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    payload = {
        "model": model,
        "temperature": 0.3,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You rewrite business QA answers in natural English using only provided sanitized facts. "
                    "Do not invent values, identifiers, names, or any missing details. "
                    "Keep responses concise (1-2 sentences)."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"User question: {question}\n"
                    f"Current template answer: {response.answer}\n"
                    f"Sanitized facts JSON: {json.dumps(safe_facts, ensure_ascii=True)}\n"
                    "Rewrite the answer naturally."
                ),
            },
        ],
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            llm_response = client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            llm_response.raise_for_status()
            content = llm_response.json()["choices"][0]["message"]["content"].strip()
            if not content:
                return response
            return ChatAskResponse(
                route=response.route,
                intent=response.intent,
                answer=content,
                data=response.data,
                sources=response.sources,
            )
    except (httpx.HTTPError, KeyError, json.JSONDecodeError):
        return response


@app.post("/chat/ask", response_model=ChatAskResponse)
def chat_ask(payload: ChatAskRequest, db: Session = Depends(get_db)):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    if is_general_out_of_scope_question(question):
        use_en = prefers_english(question)
        return ChatAskResponse(
            route="out_of_scope",
            intent="unsupported",
            answer=(
                (
                    "This question is outside the assistant's scope. "
                    "I can help with system usage, inventory, invoices, and reconciliation."
                )
                if use_en
                else (
                    "这个问题不在当前系统助手支持范围内。"
                    "我可以帮助你处理系统使用、库存、发票和对账相关问题。"
                )
            ),
            data={},
            sources=[ChatSource(source_type="system", source_value="scope_guard")],
        )

    # Hard business guards for two frequent queries.
    # This bypasses LLM routing/planning to avoid "intent guard" fallbacks.
    if asks_used_lens_count(question):
        used_total = db.execute(
            select(func.count(Lens.id)).where(Lens.is_used.is_(True))
        ).scalar_one()
        use_en = prefers_english(question)
        return ChatAskResponse(
            route="business_qa",
            intent="inventory_overview",
            answer=(
                f"目前已使用的 lens 数量是：{used_total}。" if not use_en else
                f"There are {used_total} used lenses."
            ),
            data={"used_lenses": used_total},
            sources=[ChatSource(source_type="table", source_value="lens")],
        )

    if asks_lens_count_from_company(question):
        company_name = extract_company_name_for_lens(question)
        use_en = prefers_english(question)
        if company_name:
            focus = detect_company_lens_focus(question)
            stmt = (
                select(func.count(Lens.id))
                .select_from(Lens)
                .join(LensType, Lens.type_id == LensType.id)
                .join(Company, LensType.company_id == Company.id)
                .where(func.lower(Company.name).like(f"%{company_name.lower()}%"))
            )
            if focus == "in_stock":
                stmt = stmt.where(Lens.is_used.is_(False))
            elif focus == "used":
                stmt = stmt.where(Lens.is_used.is_(True))
            elif focus == "matched":
                stmt = stmt.where(Lens.is_matched.is_(True))
            elif focus == "unmatched":
                stmt = stmt.where(Lens.is_matched.is_(False))
            lens_total = db.execute(stmt).scalar_one()
            cn_focus_text = {
                "all": "来源的 lens 数量",
                "in_stock": "来源且在库的 lens 数量",
                "used": "来源且已使用的 lens 数量",
                "matched": "来源且已匹配的 lens 数量",
                "unmatched": "来源且未匹配的 lens 数量",
            }[focus]
            en_focus_text = {
                "all": f"lenses from {company_name}",
                "in_stock": f"in-stock lenses from {company_name}",
                "used": f"used lenses from {company_name}",
                "matched": f"matched lenses from {company_name}",
                "unmatched": f"unmatched lenses from {company_name}",
            }[focus]
            return ChatAskResponse(
                route="business_qa",
                intent="lens_company_lens_count",
                answer=(
                    f"{company_name} 公司{cn_focus_text}是：{lens_total}。"
                    if not use_en
                    else f"There are {lens_total} {en_focus_text}."
                ),
                data={
                    "company_name": company_name,
                    "focus": focus,
                    "lenses_from_company": lens_total,
                },
                sources=[ChatSource(source_type="table", source_value="lens")],
            )

    query_plan = parse_query_plan_with_llm(question)
    if query_plan is None:
        intent_payload = resolve_chat_intent(question)
        route = intent_payload.route
        query_plan = build_query_plan_from_intent(intent_payload, question)
        doc_search_terms = intent_payload.doc_search_terms
    else:
        route = query_plan.route
        doc_search_terms = []
    query_plan = normalize_query_plan(query_plan, question)

    # Guard: if LLM returned a business_qa plan but it's missing required fields,
    # fall back to rule-based intent resolution.
    if (
        query_plan.route == "business_qa"
        and (not query_plan.entity or not query_plan.operation)
    ):
        intent_payload = resolve_chat_intent(question)
        route = intent_payload.route
        query_plan = build_query_plan_from_intent(intent_payload, question)

    if route == "doc_qa":
        doc_chunks = retrieve_doc_chunks(question, doc_search_terms)
        if not doc_chunks:
            return ChatAskResponse(
                route="out_of_scope",
                intent="unsupported",
                answer="I could not find enough evidence in the system documentation to answer this question.",
                data={},
                sources=[],
            )

        answer = generate_doc_answer_with_llm(question, doc_chunks)
        if not answer:
            answer = build_doc_answer_without_llm(question, doc_chunks)

        return ChatAskResponse(
            route=route,
            intent="unsupported",
            answer=answer,
            data={
                "matched_documents": [
                    {"path": chunk["path"], "chunk_index": chunk["index"]}
                    for chunk in doc_chunks
                ]
            },
            sources=[
                ChatSource(source_type="document", source_value=path)
                for path in list(dict.fromkeys(chunk["path"] for chunk in doc_chunks))
            ],
        )

    planned_response = execute_business_query_plan(query_plan, db, question)
    if planned_response is not None:
        return generate_safe_natural_business_answer(question, planned_response)

    # If business plan execution failed, try rule-based fallback.
    if query_plan.route == "business_qa":
        intent_payload = resolve_chat_intent(question)
        route = intent_payload.route
        query_plan2 = build_query_plan_from_intent(intent_payload, question)
        query_plan2 = normalize_query_plan(query_plan2, question)
        planned_response2 = execute_business_query_plan(query_plan2, db, question)
        if planned_response2 is not None:
            return generate_safe_natural_business_answer(question, planned_response2)

    return ChatAskResponse(
        route="out_of_scope",
        intent="unsupported",
        answer=(
            "I can answer two types of questions: (1) system documentation / troubleshooting, and (2) inventory overview, "
            "invoice details, and unmatched reconciliation summaries."
        ),
        data={},
        sources=[ChatSource(source_type="system", source_value="mvp_intent_guard")],
    )

# ------------------------
# Company
# ------------------------
@app.post("/company", response_model=CompanyOut, status_code=201)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Company name is required")
    company = Company(name=name)
    db.add(company)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Company already exists")
    db.refresh(company)
    return company


@app.get("/company", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    companies = db.execute(select(Company).order_by(Company.name.asc())).scalars().all()
    return companies


@app.get("/company/{company_id}", response_model=CompanyOut)
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@app.patch("/company/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Company name is required")
        company.name = name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Company already exists")
    db.refresh(company)
    return company


@app.delete("/company/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    try:
        db.delete(company)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Company is in use")
    return {"deleted": True, "id": company_id}


# ------------------------
# Supplier
# ------------------------
@app.post("/supplier", response_model=SupplierOut, status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Supplier name is required")
    supplier = Supplier(name=name)
    db.add(supplier)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Supplier already exists")
    db.refresh(supplier)
    return supplier


@app.get("/supplier", response_model=list[SupplierOut])
def list_suppliers(db: Session = Depends(get_db)):
    suppliers = db.execute(select(Supplier).order_by(Supplier.name.asc())).scalars().all()
    return suppliers


@app.get("/supplier/{supplier_id}", response_model=SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@app.patch("/supplier/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Supplier name is required")
        supplier.name = name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Supplier already exists")
    db.refresh(supplier)
    return supplier


@app.delete("/supplier/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    try:
        db.delete(supplier)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Supplier is in use")
    return {"deleted": True, "id": supplier_id}


# ------------------------
# Site
# ------------------------
@app.post("/site", response_model=SiteOut, status_code=201)
def create_site(payload: SiteCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Site name is required")
    site = Site(name=name)
    db.add(site)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Site already exists")
    db.refresh(site)
    return site


@app.get("/site", response_model=list[SiteOut])
def list_sites(db: Session = Depends(get_db)):
    sites = db.execute(select(Site).order_by(Site.name.asc())).scalars().all()
    return sites


@app.get("/site/{site_id}", response_model=SiteOut)
def get_site(site_id: int, db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@app.patch("/site/{site_id}", response_model=SiteOut)
def update_site(site_id: int, payload: SiteUpdate, db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Site name is required")
        site.name = name
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Site already exists")
    db.refresh(site)
    return site


@app.delete("/site/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Explicit guard to prevent deleting a clinic/site that is referenced by any lens (inventory).
    # This also protects SQLite setups where FK constraints might not be enforced.
    in_use_count = db.query(func.count(Lens.id)).filter(Lens.site_id == site_id).scalar()
    if in_use_count and in_use_count > 0:
        raise HTTPException(status_code=409, detail="Site is in use")
    try:
        db.delete(site)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Site is in use")
    return {"deleted": True, "id": site_id}


# ------------------------
# Lens Type
# ------------------------
@app.post("/lens-type", response_model=LensTypeOut, status_code=201)
def create_lens_type(payload: LensTypeCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Type name is required")
    company = db.get(Company, payload.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    lens_type = LensType(name=name, company_id=payload.company_id)
    db.add(lens_type)
    db.commit()
    db.refresh(lens_type)
    return {
        "id": lens_type.id,
        "name": lens_type.name,
        "company_id": lens_type.company_id,
        "company_name": company.name,
    }


@app.get("/lens-type", response_model=list[LensTypeOut])
def list_lens_types(
    company_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(LensType).order_by(LensType.name.asc())
    if company_id is not None:
        query = query.where(LensType.company_id == company_id)
    lens_types = db.execute(query).scalars().all()
    return [
        {
            "id": lens_type.id,
            "name": lens_type.name,
            "company_id": lens_type.company_id,
            "company_name": lens_type.company.name if lens_type.company else None,
        }
        for lens_type in lens_types
    ]


@app.get("/lens-type/{type_id}", response_model=LensTypeOut)
def get_lens_type(type_id: int, db: Session = Depends(get_db)):
    lens_type = db.get(LensType, type_id)
    if not lens_type:
        raise HTTPException(status_code=404, detail="Type not found")
    return {
        "id": lens_type.id,
        "name": lens_type.name,
        "company_id": lens_type.company_id,
        "company_name": lens_type.company.name if lens_type.company else None,
    }


@app.patch("/lens-type/{type_id}", response_model=LensTypeOut)
def update_lens_type(
    type_id: int,
    payload: LensTypeUpdate,
    db: Session = Depends(get_db),
):
    lens_type = db.get(LensType, type_id)
    if not lens_type:
        raise HTTPException(status_code=404, detail="Type not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Type name is required")
        lens_type.name = name
    if payload.company_id is not None:
        company = db.get(Company, payload.company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        lens_type.company_id = payload.company_id
    db.commit()
    db.refresh(lens_type)
    return {
        "id": lens_type.id,
        "name": lens_type.name,
        "company_id": lens_type.company_id,
        "company_name": lens_type.company.name if lens_type.company else None,
    }


@app.delete("/lens-type/{type_id}")
def delete_lens_type(type_id: int, db: Session = Depends(get_db)):
    lens_type = db.get(LensType, type_id)
    if not lens_type:
        raise HTTPException(status_code=404, detail="Type not found")

    # Explicit guard to prevent deleting a type that is referenced by any lens
    in_use_count = db.query(func.count(Lens.id)).filter(Lens.type_id == type_id).scalar()
    if in_use_count and in_use_count > 0:
        raise HTTPException(status_code=409, detail="Type is in use")

    try:
        db.delete(lens_type)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Type is in use")
    return {"deleted": True, "id": type_id}

# ------------------------
# Create
# ------------------------
@app.post("/lens", response_model=ReceivedLensOut, status_code=201)
def create_lens(payload: ReceivedLensCreate, db: Session = Depends(get_db)):
    """
    Create a new lens. 
    When receiving a lens, is_used and is_matched are always False by default,
    regardless of what the client sends.
    """
    type_id = payload.type_id
    if type_id is None and payload.type:
        type_id = resolve_type_id(db, payload.type, payload.company)

    site_id = payload.site_id
    if site_id is not None and not db.get(Site, site_id):
        raise HTTPException(status_code=404, detail="Site not found")
    if site_id is None and payload.site:
        site_id = resolve_site_id(db, payload.site)
        if site_id is None:
            raise HTTPException(status_code=404, detail="Site not found")

    lens = Lens(
        serial_number=payload.serial_number,
        received_date=payload.received_date or None,
        used_date=None,
        is_used=False,  # Always False when receiving
        is_matched=False,  # Always False when receiving
        type_id=type_id,
        power=payload.power,
        site_id=site_id,
        invoice_id=payload.invoice_id,
    )

    db.add(lens)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Serial number already exists")

    db.refresh(lens)
    return lens


    db.add(lens)

    try:
        db.commit()   
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Serial number already exists"
        )

    db.refresh(lens)
    return lens


@app.post("/lens/bulk", response_model=ReceivedLensBulkResponse, status_code=201)
def create_lens_bulk(payload: ReceivedLensBulkCreate, db: Session = Depends(get_db)):
    created_ids: list[int] = []
    duplicates: list[str] = []

    for item in payload.items:
        """
        Create lenses in bulk. 
        When receiving lenses, is_used and is_matched are always False by default,
        regardless of what the client sends.
        """
        type_id = item.type_id
        if type_id is None and item.type:
            type_id = resolve_type_id(db, item.type, item.company)

        site_id = item.site_id
        if site_id is not None and not db.get(Site, site_id):
            raise HTTPException(status_code=404, detail="Site not found")
        if site_id is None and item.site:
            site_id = resolve_site_id(db, item.site)
            if site_id is None:
                raise HTTPException(status_code=404, detail="Site not found")

        lens = Lens(
            serial_number=item.serial_number,
            received_date=item.received_date or None,
            used_date=None,
            is_used=False,  # Always False when receiving
            is_matched=False,  # Always False when receiving
            type_id=type_id,
            power=item.power,
            site_id=site_id,
            invoice_id=item.invoice_id,
        )

        db.add(lens)

        try:
            db.commit()
            db.refresh(lens)
            created_ids.append(lens.id)
        except IntegrityError:
            db.rollback()
            duplicates.append(item.serial_number)

    return ReceivedLensBulkResponse(created_ids=created_ids, duplicates=duplicates)

# ------------------------
# Read (list)
# ------------------------
@app.get("/lens", response_model=list[ReceivedLensOut])
def list_lens(
    is_used: bool | None = None,
    is_matched: bool | None = None,
    db: Session = Depends(get_db),
):
    query = select(Lens)

    if is_used is not None:
        query = query.where(Lens.is_used == is_used)
    if is_matched is not None:
        query = query.where(Lens.is_matched == is_matched)

    query = query.order_by(Lens.id.desc())
    lenses = db.execute(query).scalars().all()
    return lenses

# ------------------------
# Read (by id)
# ------------------------
@app.get("/lens/{lens_id}", response_model=ReceivedLensOut)
def get_lens(lens_id: int, db: Session = Depends(get_db)):
    lens = db.get(Lens, lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Lens not found")
    return lens

# ------------------------
# Update
# ------------------------
@app.patch("/lens/{lens_id}", response_model=ReceivedLensOut)
def update_lens(lens_id: int, payload: ReceivedLensUpdate, db: Session = Depends(get_db)):
    lens = db.get(Lens, lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Lens not found")

    if payload.serial_number is not None:
        lens.serial_number = payload.serial_number
    if payload.received_date is not None:
        lens.received_date = payload.received_date
    if payload.used_date is not None:
        lens.used_date = payload.used_date
    if payload.is_used is not None:
        lens.is_used = payload.is_used
    if payload.is_matched is not None:
        lens.is_matched = payload.is_matched
    if payload.type_id is not None:
        lens.type_id = payload.type_id
    elif payload.type is not None or payload.company is not None:
        type_name = payload.type if payload.type is not None else lens.type
        company_name = payload.company if payload.company is not None else lens.company
        lens.type_id = resolve_type_id(db, type_name, company_name)
    if payload.power is not None:
        lens.power = payload.power
    if payload.site_id is not None:
        if not db.get(Site, payload.site_id):
            raise HTTPException(status_code=404, detail="Site not found")
        lens.site_id = payload.site_id
    elif payload.site is not None:
        site_id = resolve_site_id(db, payload.site)
        if site_id is None:
            raise HTTPException(status_code=404, detail="Site not found")
        lens.site_id = site_id
    if payload.invoice_id is not None:
        lens.invoice_id = payload.invoice_id

    db.commit()
    db.refresh(lens)
    return lens

# ------------------------
# Delete
# ------------------------
@app.delete("/lens/{lens_id}")
def delete_lens(lens_id: int, db: Session = Depends(get_db)):
    lens = db.get(Lens, lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Lens not found")

    db.delete(lens)
    db.commit()
    return {"deleted": True, "id": lens_id}


# ------------------------
# Bulk Status Update
# ------------------------
@app.post("/lens/update-status", response_model=BulkStatusUpdateResponse)
def update_lens_status(
    payload: BulkStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Bulk update is_used and is_matched status for multiple lenses.
    This is called after invoice matching to sync the database with comparison results.
    """
    updated_count = 0
    not_found = []
    duplicates = []
    errors = []

    for update in payload.updates:
        try:
            # Find lens by serial number
            stmt = select(Lens).where(Lens.serial_number == update.serial_number)
            lens = db.execute(stmt).scalar_one_or_none()
            
            if lens is None:
                not_found.append(update.serial_number)
                continue
            
            # Update only the fields that are provided (both are optional)
            if update.is_used is not None:
                lens.is_used = update.is_used
            if update.is_matched is not None:
                lens.is_matched = update.is_matched
            updated_count += 1
            
        except Exception as e:
            errors.append(f"{update.serial_number}: {str(e)}")
            continue
    
    # Commit all changes
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit status updates: {str(e)}"
        )
    
    return BulkStatusUpdateResponse(
        updated_count=updated_count,
        not_found=not_found,
        errors=errors
    )


@app.post("/lens/update-used", response_model=BulkUsedUpdateResponse)
def update_lens_used(
    payload: BulkUsedUpdate,
    db: Session = Depends(get_db)
):
    """
    Bulk update only is_used status for multiple lenses.
    This is called after Excel upload to mark lenses as used.
    """
    updated_count = 0
    not_found = []
    duplicates = []
    errors = []

    for update in payload.updates:
        try:
            # Find lens by serial number
            stmt = select(Lens).where(Lens.serial_number == update.serial_number)
            lens = db.execute(stmt).scalar_one_or_none()
            
            if lens is None:
                not_found.append(update.serial_number)
                continue
            
            # Update only is_used status
            if update.is_used and lens.is_used:
                duplicates.append(update.serial_number)
                continue
            lens.is_used = update.is_used
            if update.is_used:
                lens.used_date = update.used_date or date.today()
            else:
                lens.used_date = None
            updated_count += 1
            
        except Exception as e:
            errors.append(f"{update.serial_number}: {str(e)}")
            continue
    
    # Commit all changes
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to commit is_used updates: {str(e)}"
        )
    
    return BulkUsedUpdateResponse(
        updated_count=updated_count,
        not_found=not_found,
        duplicates=duplicates,
        errors=errors
    )


# ------------------------
# Invoice PDF Extraction (Self-Learning System)
# ------------------------
@app.post("/extract-invoices", response_model=InvoiceExtractionResponse)
async def extract_invoices(
    files: list[UploadFile] = File(...),
    persist: bool = False,  # Default to False - let user review first
    db: Session = Depends(get_db),
):
    """
    Upload one or more PDF files and extract invoice information using learned rules.
    
    Self-learning workflow:
    1. First upload of a new layout: Returns empty fields, user must fill in
    2. User corrects data and saves: System learns the patterns
    3. Subsequent uploads of same layout: System extracts using learned rules
    
    Returns extracted data for user review before saving.
    """
    results = []
    successful = 0
    failed = 0
    learner = get_learner()
    
    for file in files:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            results.append(InvoiceExtractedData(
                file_name=file.filename,
                error="File is not a PDF"
            ))
            failed += 1
            continue
        
        # Save uploaded file temporarily
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                content = await file.read()
                tmp.write(content)
                tmp_path = tmp.name
            
            # Generate fingerprint and extract text
            fingerprint, text_markers, full_text = learner.generate_fingerprint(tmp_path)
            _, layout_data = extract_text_and_layout(tmp_path)
            
            if not full_text.strip():
                results.append(InvoiceExtractedData(
                    file_name=file.filename,
                    error="Unable to extract text from PDF"
                ))
                failed += 1
                continue
            
            # Try to find a matching learned layout
            matched_layout = learner.find_matching_layout(fingerprint, text_markers, full_text)
            
            if matched_layout:
                # Use learned rules to extract data
                extracted = learner.extract_with_rules(full_text, matched_layout)
                supplier_name = extracted.get('supplier_name')
                invoice_number = extracted.get('invoice_number')
                serial_numbers = extracted.get('serial_numbers', [])
                confidence = extracted.get('confidence', 'high')
            else:
                # Unknown layout - return empty for user to fill in
                supplier_name = None
                invoice_number = None
                serial_numbers = []
                confidence = 'low'
            
            if persist and supplier_name and invoice_number and serial_numbers:
                # Save to database
                upload_date = date.today()
                invoice_supplier = get_or_create_supplier(db, supplier_name)
                invoice_supplier_id = invoice_supplier.id if invoice_supplier else None
                for sn in serial_numbers:
                    invoice = Invoice(
                        upload_date=upload_date,
                        invoice_number=invoice_number,
                        serial_number=sn,
                        supplier_id=invoice_supplier_id,
                    )
                    db.add(invoice)
                try:
                    db.commit()
                except Exception as db_error:
                    db.rollback()
                    print(f"Database error for {file.filename}: {db_error}")
            
            error_msg = None
            if not matched_layout:
                error_msg = "New invoice layout - please fill in the fields and save to teach the system"
            
            results.append(InvoiceExtractedData(
                file_name=file.filename,
                company=supplier_name,
                issuer_company_name=supplier_name,
                invoice_number=invoice_number,
                serial_numbers=serial_numbers,
                pdf_text=full_text,
                layout_data=layout_data,
                error=error_msg
            ))
            successful += 1
            
        except Exception as e:
            results.append(InvoiceExtractedData(
                file_name=file.filename,
                error=str(e)
            ))
            failed += 1
        
        finally:
            # Clean up temp file
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    return InvoiceExtractionResponse(
        success=failed == 0,
        data=results,
        total_files=len(files),
        successful_extractions=successful,
        failed_extractions=failed
    )


# ------------------------
# Invoice Extraction with Learning Support (Main Endpoint)
# ------------------------
@app.post("/extract-invoices-with-learning", response_model=InvoiceExtractionResponseWithText)
async def extract_invoices_with_learning(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    """
    Upload one or more PDF files and extract invoice information using the self-learning system.
    
    Self-learning workflow:
    1. First upload of a new layout: Returns empty fields, user must fill in
    2. User corrects data and saves via /invoice/save: System learns the patterns
    3. Subsequent uploads of same layout: System extracts using learned rules
    
    Returns:
    - PDF text (for user to see and correct)
    - Layout fingerprint (for learning association)
    - Extracted data (if layout is known)
    - Confidence level
    """
    results = []
    successful = 0
    failed = 0
    learner = get_learner()
    
    for file in files:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            results.append(InvoiceExtractedDataWithText(
                file_name=file.filename,
                error="File is not a PDF"
            ))
            failed += 1
            continue
        
        # Save uploaded file temporarily
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
                content = await file.read()
                tmp.write(content)
                tmp_path = tmp.name
            
            # Generate fingerprint and extract text
            fingerprint, text_markers, full_text = learner.generate_fingerprint(tmp_path)
            _, layout_data = extract_text_and_layout(tmp_path)
            
            if not full_text.strip():
                results.append(InvoiceExtractedDataWithText(
                    file_name=file.filename,
                    error="Unable to extract text from PDF"
                ))
                failed += 1
                continue
            
            # Try to find a matching learned layout
            matched_layout = learner.find_matching_layout(fingerprint, text_markers, full_text)
            
            if matched_layout:
                # Use learned rules to extract data
                extracted = learner.extract_with_rules(full_text, matched_layout)
                supplier_name = extracted.get('supplier_name')
                invoice_number = extracted.get('invoice_number')
                serial_numbers = extracted.get('serial_numbers', [])
                confidence = 'high' if invoice_number and serial_numbers else 'medium'
                error_msg = None
            else:
                # Unknown layout - return empty for user to fill in
                supplier_name = None
                invoice_number = None
                serial_numbers = []
                confidence = 'low'
                error_msg = "New invoice layout - please fill in the fields and save to teach the system"
            
            # Check if invoice already exists in database
            exists_in_db = False
            if invoice_number:
                existing_invoice = db.query(Invoice).filter(
                    Invoice.invoice_number == invoice_number
                ).first()
                exists_in_db = existing_invoice is not None
            
            results.append(InvoiceExtractedDataWithText(
                file_name=file.filename,
                company=supplier_name,
                issuer_company_name=supplier_name,
                invoice_number=invoice_number,
                serial_numbers=serial_numbers,
                pdf_text=full_text,
                layout_data=layout_data,
                layout_fingerprint=fingerprint,  # Include fingerprint for learning
                confidence=confidence,
                exists_in_db=exists_in_db,
                error=error_msg
            ))
            successful += 1
            
        except Exception as e:
            results.append(InvoiceExtractedDataWithText(
                file_name=file.filename,
                error=str(e)
            ))
            failed += 1
        
        finally:
            # Clean up temp file
            if 'tmp_path' in locals() and os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    return InvoiceExtractionResponseWithText(
        success=failed == 0,
        data=results,
        total_files=len(files),
        successful_extractions=successful,
        failed_extractions=failed
    )


# ------------------------
# Invoice Learn Endpoint (Learning Only - No DB Save)
# ------------------------
@app.post("/invoice/learn")
async def learn_invoice_layout(payload: InvoiceSaveRequest):
    """
    Learn extraction patterns from user corrections WITHOUT saving to database.
    
    This endpoint is called when user clicks "Save & Learn Rules".
    It only learns the layout patterns for future extraction.
    Database save happens separately via "Upload All" button.
    """
    try:
        if not payload.pdf_text:
            return {"success": False, "message": "PDF text is required for learning"}
        
        if not payload.invoice_number or not payload.serial_numbers:
            return {"success": False, "message": "Invoice number and serial numbers are required for learning"}
        
        if not payload.supplier_name:
            return {"success": False, "message": "Supplier name is required for learning"}

        learner = get_learner()
        
        # Extract text markers from the first few lines
        lines = payload.pdf_text.split('\n')[:15]
        text_markers = []
        for line in lines:
            line = line.strip()
            if len(line) > 5 and len(line) < 100:
                if not any(skip in line.lower() for skip in 
                           ['invoice', 'date', 'total', 'gst', 'tax', 'page', 
                            'phone', 'fax', 'email', 'address', 'po box']):
                    text_markers.append(line)
        text_markers = text_markers[:10]
        
        # Use provided fingerprint if available, otherwise generate from text
        if payload.layout_fingerprint:
            fingerprint = payload.layout_fingerprint
        else:
            # Fallback: generate from text (less accurate)
            import hashlib
            fingerprint = hashlib.md5(payload.pdf_text[:500].encode()).hexdigest()[:16]
        
        # Learn the patterns
        learner.learn_from_correction(
            pdf_path=None,
            fingerprint=fingerprint,
            text_markers=text_markers,
            full_text=payload.pdf_text,
            supplier_name=payload.supplier_name,
            invoice_number=payload.invoice_number,
            serial_numbers=payload.serial_numbers
        )
        
        return {
            "success": True,
            "message": f"Successfully learned extraction patterns for {payload.supplier_name}",
            "fingerprint": fingerprint
        }
        
    except Exception as e:
        return {"success": False, "message": f"Error learning patterns: {str(e)}"}


# ------------------------
# Invoice Save Endpoint (with Learning)
# ------------------------
@app.post("/invoice/save", response_model=InvoiceSaveResponse)
async def save_invoice_data(payload: InvoiceSaveRequest, db: Session = Depends(get_db)):
    """
    Save corrected invoice data to the database AND learn extraction patterns.
    
    This endpoint is called after user corrections. It:
    1. Saves invoice data to database
    2. Learns extraction patterns for future invoices with same layout
    
    If overwrite=True (default), updates existing records with the same invoice number.
    """
    try:
        if not payload.invoice_number or not payload.serial_numbers:
            return InvoiceSaveResponse(
                success=False,
                message="Invoice number and at least one serial number are required",
                saved_count=0
            )
        
        if not payload.supplier_name:
            return InvoiceSaveResponse(
                success=False,
                message="Supplier name is required",
                saved_count=0
            )

        # Learn from this correction if PDF text is provided
        if payload.pdf_text:
            learner = get_learner()
            
            # Extract text markers from the first few lines
            lines = payload.pdf_text.split('\n')[:15]
            text_markers = []
            for line in lines:
                line = line.strip()
                if len(line) > 5 and len(line) < 100:
                    if not any(skip in line.lower() for skip in 
                               ['invoice', 'date', 'total', 'gst', 'tax', 'page', 
                                'phone', 'fax', 'email', 'address', 'po box']):
                        text_markers.append(line)
            text_markers = text_markers[:10]
            
            # Use provided fingerprint if available, otherwise generate from text
            if payload.layout_fingerprint:
                fingerprint = payload.layout_fingerprint
            else:
                # Fallback: generate from text (less accurate)
                import hashlib
                fingerprint = hashlib.md5(payload.pdf_text[:500].encode()).hexdigest()[:16]
            
            # Learn the patterns
            learner.learn_from_correction(
                pdf_path=None,  # We don't have the file anymore
                fingerprint=fingerprint,
                text_markers=text_markers,
                full_text=payload.pdf_text,
                supplier_name=payload.supplier_name,
                invoice_number=payload.invoice_number,
                serial_numbers=payload.serial_numbers
            )

        supplier = get_or_create_supplier(db, payload.supplier_name)
        supplier_id = supplier.id if supplier else None
        
        upload_date = date.today()
        saved_count = 0
        
        # If overwrite is True, delete all existing records with this invoice number first
        if payload.overwrite:
            db.query(Invoice).filter(
                Invoice.invoice_number == payload.invoice_number
            ).delete()
        
        for sn in payload.serial_numbers:
            # Check if this invoice+SN combination already exists
            existing = db.query(Invoice).filter(
                Invoice.invoice_number == payload.invoice_number,
                Invoice.serial_number == sn
            ).first()
            
            if existing:
                # Update existing record
                existing.supplier_id = supplier_id
                existing.upload_date = upload_date
            else:
                # Create new record
                invoice_record = Invoice(
                    upload_date=upload_date,
                    invoice_number=payload.invoice_number,
                    serial_number=sn,
                    supplier_id=supplier_id,
                )
                db.add(invoice_record)
            
            saved_count += 1
        
        db.commit()
        
        learn_msg = " and learned extraction patterns" if payload.pdf_text else ""
        return InvoiceSaveResponse(
            success=True,
            message=f"Successfully saved {saved_count} invoice records{learn_msg}",
            saved_count=saved_count
        )
        
    except Exception as e:
        db.rollback()
        return InvoiceSaveResponse(
            success=False,
            message=f"Error saving invoice data: {str(e)}",
            saved_count=0
        )


@app.post("/invoice/check-exists", response_model=InvoiceCheckExistsResponse)
async def check_invoice_exists(payload: InvoiceCheckExistsRequest, db: Session = Depends(get_db)):
    """
    Check if an invoice number already exists in the database.
    
    Returns whether the invoice exists and the associated serial numbers if it does.
    """
    try:
        existing_invoices = db.query(Invoice).filter(
            Invoice.invoice_number == payload.invoice_number
        ).all()
        
        exists = len(existing_invoices) > 0
        serial_numbers = [inv.serial_number for inv in existing_invoices] if exists else []
        
        return InvoiceCheckExistsResponse(
            exists=exists,
            invoice_number=payload.invoice_number,
            serial_numbers=serial_numbers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking invoice: {str(e)}")


# ------------------------
# Invoice Learning Management
# ------------------------
@app.get("/invoice/learned-layouts")
async def get_learned_layouts():
    """
    Get all learned invoice layouts.
    
    Returns a list of all layouts that the system has learned to extract.
    Useful for debugging and managing the learning system.
    """
    learner = get_learner()
    layouts = learner.get_all_layouts()
    return {
        "success": True,
        "layouts": layouts,
        "total": len(layouts)
    }


@app.delete("/invoice/learned-layouts/{fingerprint}")
async def delete_learned_layout(fingerprint: str):
    """
    Delete a learned layout by fingerprint.
    
    This will cause the system to "forget" how to extract data from
    invoices with this layout.
    """
    learner = get_learner()
    success = learner.delete_layout(fingerprint)
    if success:
        return {"success": True, "message": f"Deleted layout {fingerprint}"}
    else:
        raise HTTPException(status_code=404, detail=f"Layout {fingerprint} not found")


@app.delete("/invoice/learned-layouts")
async def clear_all_learned_layouts():
    """
    Clear all learned layouts.
    
    This resets the system to its initial state with no knowledge
    of any invoice layouts.
    """
    learner = get_learner()
    learner.clear_all()
    return {"success": True, "message": "Cleared all learned layouts"}


# ------------------------
# Excel Serial Number Extraction
# ------------------------
@app.post("/extract-excel-serial-numbers", response_model=ExcelExtractionResponse)
async def extract_excel_serial_numbers(file: UploadFile = File(...)):
    """
    Upload an Excel file to extract serial numbers and dates.
    Supports multiple sheets (one per brand).
    
    Returns extracted data including:
    - Serial numbers
    - Dates
    - Sheet names (brands)
    """
    print(f"\n{'='*60}")
    print(f"📥 Received Excel file: {file.filename}")
    print(f"{'='*60}")
    
    # Validate file type
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        print("❌ Invalid file type")
        return ExcelExtractionResponse(
            success=False,
            data=[],
            total_rows=0,
            error="File must be an Excel file (.xlsx or .xls)"
        )
    
    try:
        # Read file content
        content = await file.read()
        print(f"✓ File read: {len(content)} bytes")
        
        # Process Excel file
        print("🔄 Processing Excel file...")
        extracted_data = process_excel_file(content)
        print(f"✓ Extracted {len(extracted_data)} rows")
        
        # Convert to Pydantic models
        rows = [
            ExcelExtractedRow(
                serial_number=row['serial_number'],
                sheet_name=row['sheet_name']
            )
            for row in extracted_data
        ]
        
        if not rows:
            print("❌ No rows extracted")
            return ExcelExtractionResponse(
                success=False,
                data=[],
                total_rows=0,
                error="No serial numbers found. Please ensure your Excel file has a 'Serial Number' or 'Serial No.' column."
            )
        
        print(f"✅ Success! Returning {len(rows)} rows")
        print(f"{'='*60}\n")
        
        return ExcelExtractionResponse(
            success=True,
            data=rows,
            total_rows=len(rows),
            error=None
        )
        
    except Exception as e:
        print(f"❌ Exception occurred: {str(e)}")
        print(f"{'='*60}\n")
        # Simplify error message for users
        error_msg = str(e)
        if 'Serial Number' in error_msg or 'Serial No.' in error_msg:
            error_msg = "Could not find 'Serial Number' or 'Serial No.' column in Excel file."
        else:
            error_msg = "Failed to process Excel file. Please check the file format."
        
        return ExcelExtractionResponse(
            success=False,
            data=[],
            total_rows=0,
            error=error_msg
        )
# Barcode Image Decode (pyzbar)
# ------------------------
def _detect_multiple_barcodes_region_scan(img: Image.Image, decoder_func, symbols=None, max_regions=12):
    """
    Detect multiple barcodes by scanning different regions of the image.
    Uses vertical band scanning and grid scanning strategies.
    
    Args:
        img: PIL Image to scan
        decoder_func: Function to decode barcodes (zbar_decode or similar)
        symbols: List of barcode symbols to detect (for pyzbar)
        max_regions: Maximum number of regions to scan
        
    Returns:
        List of detected barcode results
    """
    results = []
    width, height = img.size
    
    # Strategy 1: Vertical band scanning (for horizontal barcodes)
    # Divide image into overlapping vertical bands
    num_bands = min(12, max_regions // 2)
    overlap_ratio = 0.3  # 30% overlap
    
    band_width = width // num_bands
    overlap_width = int(band_width * overlap_ratio)
    
    for i in range(num_bands):
        left = max(0, i * band_width - overlap_width)
        right = min(width, (i + 1) * band_width + overlap_width)
        
        # Extract band region
        band = img.crop((left, 0, right, height))
        
        try:
            if symbols:
                decoded = decoder_func(band, symbols=symbols)
            else:
                decoded = decoder_func(band)
            
            if decoded:
                for d in decoded:
                    text = (d.data.decode("utf-8", errors="ignore") if isinstance(d.data, (bytes, bytearray)) else str(d.data))
                    # Adjust coordinates to original image
                    if hasattr(d, 'polygon') and d.polygon:
                        adjusted_polygon = [(x + left, y) for x, y in d.polygon]
                    else:
                        adjusted_polygon = None
                    
                    result = {
                        "text": text,
                        "format": d.type if hasattr(d, 'type') else "UNKNOWN",
                        "points": adjusted_polygon,
                        "region": f"vertical_band_{i}",
                    }
                    # Avoid duplicates
                    if not any(r["text"] == text for r in results):
                        results.append(result)
        except Exception as e:
            print(f"[MULTI-BARCODE] Error scanning vertical band {i}: {e}")
            continue
    
    # Strategy 2: Grid scanning (for barcodes at various positions)
    # Divide image into overlapping grid cells
    grid_rows = 4
    grid_cols = 4
    cell_width = width // grid_cols
    cell_height = height // grid_rows
    grid_overlap = int(min(cell_width, cell_height) * 0.2)  # 20% overlap
    
    for row in range(grid_rows):
        for col in range(grid_cols):
            left = max(0, col * cell_width - grid_overlap)
            right = min(width, (col + 1) * cell_width + grid_overlap)
            top = max(0, row * cell_height - grid_overlap)
            bottom = min(height, (row + 1) * cell_height + grid_overlap)
            
            # Extract grid cell
            cell = img.crop((left, top, right, bottom))
            
            try:
                if symbols:
                    decoded = decoder_func(cell, symbols=symbols)
                else:
                    decoded = decoder_func(cell)
                
                if decoded:
                    for d in decoded:
                        text = (d.data.decode("utf-8", errors="ignore") if isinstance(d.data, (bytes, bytearray)) else str(d.data))
                        # Adjust coordinates to original image
                        if hasattr(d, 'polygon') and d.polygon:
                            adjusted_polygon = [(x + left, y + top) for x, y in d.polygon]
                        else:
                            adjusted_polygon = None
                        
                        result = {
                            "text": text,
                            "format": d.type if hasattr(d, 'type') else "UNKNOWN",
                            "points": adjusted_polygon,
                            "region": f"grid_{row}_{col}",
                        }
                        # Avoid duplicates
                        if not any(r["text"] == text for r in results):
                            results.append(result)
            except Exception as e:
                print(f"[MULTI-BARCODE] Error scanning grid cell ({row}, {col}): {e}")
                continue
    
    return results


def _preprocess_image_for_barcode(img: Image.Image, method: str) -> Image.Image:
    """
    Preprocess image for better barcode recognition.
    
    Args:
        img: PIL Image object (RGB mode)
        method: Preprocessing method name
        
    Returns:
        Preprocessed PIL Image
    """
    if method == "original":
        return img.convert("RGB")
    elif method == "grayscale":
        # Convert to grayscale
        return img.convert("L").convert("RGB")
    elif method == "high_contrast":
        # Increase contrast (matching frontend: contrastFactor=2.5, brightnessAdjust=20)
        enhancer = ImageEnhance.Contrast(img)
        enhanced = enhancer.enhance(2.5)
        # Apply brightness adjustment
        brightness_enhancer = ImageEnhance.Brightness(enhanced)
        return brightness_enhancer.enhance(1.08)  # ~20/255 brightness increase
    elif method == "grayscale_contrast":
        # Grayscale + high contrast (matching frontend)
        gray = img.convert("L")
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(2.5)
        # Apply brightness adjustment
        brightness_enhancer = ImageEnhance.Brightness(enhanced)
        return brightness_enhancer.enhance(1.08).convert("RGB")
    elif method == "binary":
        # Convert to binary (black and white) using adaptive threshold
        gray = img.convert("L")
        # Calculate adaptive threshold using median (better for varying lighting)
        try:
            # Use PIL's built-in histogram for threshold calculation
            histogram = gray.histogram()
            total_pixels = sum(histogram)
            cumulative = 0
            threshold = 128
            for i, count in enumerate(histogram):
                cumulative += count
                if cumulative >= total_pixels * 0.5:  # Median
                    threshold = i
                    break
        except:
            threshold = 128
        return gray.point(lambda x: 255 if x > threshold else 0, mode="1").convert("RGB")
    elif method == "binary_aggressive":
        # More aggressive binary threshold for difficult images
        gray = img.convert("L")
        try:
            histogram = gray.histogram()
            total_pixels = sum(histogram)
            cumulative = 0
            threshold = 100
            # Use 40th percentile for more aggressive thresholding
            for i, count in enumerate(histogram):
                cumulative += count
                if cumulative >= total_pixels * 0.4:
                    threshold = i
                    break
        except:
            threshold = 100
        return gray.point(lambda x: 255 if x > threshold else 0, mode="1").convert("RGB")
    elif method == "enhanced_binary":
        # Enhanced binary: high contrast -> grayscale -> aggressive binary
        gray = img.convert("L")
        # Apply high contrast first
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(3.0)
        # Then apply aggressive binary threshold
        try:
            histogram = enhanced.histogram()
            total_pixels = sum(histogram)
            cumulative = 0
            threshold = 100
            # Use 35th percentile
            for i, count in enumerate(histogram):
                cumulative += count
                if cumulative >= total_pixels * 0.35:
                    threshold = i
                    break
        except:
            threshold = 100
        return enhanced.point(lambda x: 255 if x > threshold else 0, mode="1").convert("RGB")
    elif method == "invert":
        # Invert colors (useful for white barcodes on dark background)
        return ImageOps.invert(img.convert("RGB"))
    elif method == "sharpen":
        # Sharpen the image
        enhancer = ImageEnhance.Sharpness(img)
        return enhancer.enhance(2.0)
    elif method == "morphology":
        # Morphological operations for noise reduction (using OpenCV if available)
        if _OPENCV_AVAILABLE:
            try:
                import numpy as np
                img_array = np.array(img.convert("RGB"))
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
                # Apply morphological opening to remove noise
                kernel = np.ones((3, 3), np.uint8)
                opened = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel)
                # Convert back to RGB PIL Image
                opened_rgb = cv2.cvtColor(opened, cv2.COLOR_GRAY2RGB)
                return Image.fromarray(opened_rgb)
            except Exception as e:
                print(f"[DEBUG] Morphology preprocessing failed: {e}")
                return img
        else:
            return img
    elif method == "adaptive_threshold":
        # Adaptive thresholding (using OpenCV if available)
        if _OPENCV_AVAILABLE:
            try:
                import numpy as np
                img_array = np.array(img.convert("RGB"))
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
                # Apply adaptive threshold
                adaptive = cv2.adaptiveThreshold(
                    gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
                )
                # Convert back to RGB PIL Image
                adaptive_rgb = cv2.cvtColor(adaptive, cv2.COLOR_GRAY2RGB)
                return Image.fromarray(adaptive_rgb)
            except Exception as e:
                print(f"[DEBUG] Adaptive threshold preprocessing failed: {e}")
                return img
        else:
            return img
    elif method == "gaussian_blur":
        # Gaussian blur for noise reduction (using OpenCV if available)
        if _OPENCV_AVAILABLE:
            try:
                import numpy as np
                img_array = np.array(img.convert("RGB"))
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                # Apply Gaussian blur
                blurred = cv2.GaussianBlur(img_array, (5, 5), 0)
                # Convert back to RGB PIL Image
                blurred_rgb = cv2.cvtColor(blurred, cv2.COLOR_BGR2RGB)
                return Image.fromarray(blurred_rgb)
            except Exception as e:
                print(f"[DEBUG] Gaussian blur preprocessing failed: {e}")
                return img
        else:
            return img
    elif method == "clahe":
        # Contrast Limited Adaptive Histogram Equalization (using OpenCV if available)
        if _OPENCV_AVAILABLE:
            try:
                import numpy as np
                img_array = np.array(img.convert("RGB"))
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                # Convert to LAB color space
                lab = cv2.cvtColor(img_array, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)
                # Apply CLAHE to L channel
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                l_clahe = clahe.apply(l)
                # Merge channels and convert back
                lab_clahe = cv2.merge([l_clahe, a, b])
                bgr_clahe = cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2BGR)
                rgb_clahe = cv2.cvtColor(bgr_clahe, cv2.COLOR_BGR2RGB)
                return Image.fromarray(rgb_clahe)
            except Exception as e:
                print(f"[DEBUG] CLAHE preprocessing failed: {e}")
                return img
        else:
            return img
    else:
        return img


@app.post("/barcode/decode")
async def decode_barcode(image: UploadFile = File(...)):
    """
    Decode 1D/2D barcodes from an uploaded image using multiple engines:
    - pyzbar (ZBar) - primary engine
    - OpenCV barcode detector - fallback
    - pylibdmtx - for Data Matrix codes
    
    Tries multiple preprocessing methods if initial decode fails.

    Returns a list of decoded texts and their formats.
    """
    # Check if at least one barcode detection engine is available
    if not _PYZBAR_AVAILABLE and not (_OPENCV_AVAILABLE and _OPENCV_BARCODE_DETECTOR is not None) and not _PYLIBDMTX_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Barcode decoding service unavailable: No barcode detection engines available. Please install pyzbar, OpenCV, or pylibdmtx.",
        )
    
    # Warn if pyzbar is not available but continue with other engines
    if not _PYZBAR_AVAILABLE:
        print("[BARCODE DEBUG] WARNING: pyzbar not available, using OpenCV/pylibdmtx only")

    try:
        content = await image.read()
        original_img = Image.open(BytesIO(content)).convert("RGB")
        
        # Optimize image size for barcode recognition
        # Optimal range: 1000-2000px for best balance between detail and processing speed
        # Too large (>2500px) causes performance issues and doesn't improve recognition
        # Too small (<800px) may not have enough resolution for small barcodes
        width, height = original_img.size
        original_size = (width, height)
        
        # Target optimal size: 1800px on longest side
        optimal_size = 1800
        min_size = 800
        
        if width > 2500 or height > 2500:
            # Downscale very large images
            if width > height:
                new_width = optimal_size
                new_height = int(height * (optimal_size / width))
            else:
                new_height = optimal_size
                new_width = int(width * (optimal_size / height))
            original_img = original_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"[BARCODE DEBUG] Resized large image from {original_size} to {new_width}x{new_height}")
        elif width < min_size or height < min_size:
            # Upscale small images for better barcode detection
            scale_factor = min_size / min(width, height)
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            # Cap at optimal size to avoid making it too large
            if new_width > optimal_size or new_height > optimal_size:
                if new_width > new_height:
                    scale_factor = optimal_size / new_width
                    new_width = optimal_size
                    new_height = int(new_height * scale_factor)
                else:
                    scale_factor = optimal_size / new_height
                    new_height = optimal_size
                    new_width = int(new_width * scale_factor)
            original_img = original_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"[BARCODE DEBUG] Upscaled small image from {original_size} to {new_width}x{new_height}")
        elif (width > optimal_size or height > optimal_size) and (width <= 2500 and height <= 2500):
            # Slightly downscale if slightly over optimal but not too large
            if width > height:
                scale_factor = optimal_size / width
            else:
                scale_factor = optimal_size / height
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            original_img = original_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"[BARCODE DEBUG] Optimized image size from {original_size} to {new_width}x{new_height}")

        # Try to include all available barcode formats (only if pyzbar is available)
        symbols = []
        if _PYZBAR_AVAILABLE:
            symbols = [
                ZBarSymbol.CODE128,
                ZBarSymbol.CODE39,
                ZBarSymbol.CODE93,
                ZBarSymbol.EAN13,
                ZBarSymbol.EAN8,
                ZBarSymbol.UPCA,
                ZBarSymbol.UPCE,
                ZBarSymbol.QRCODE,
                ZBarSymbol.DATABAR,
                ZBarSymbol.DATABAR_EXP,
            ]
            # Add DATAMATRIX if available (some zbar versions support it)
            try:
                if hasattr(ZBarSymbol, 'DATAMATRIX'):
                    symbols.append(ZBarSymbol.DATAMATRIX)
            except:
                pass

        # Fast path: Try original image first (works for most cases)
        # Only try other methods if original fails
        # Enhanced preprocessing methods based on research
        preprocessing_methods = [
            "original",           # First try original image (fastest, works 90% of the time)
            "high_contrast",      # Then high contrast (most effective fallback)
            "grayscale_contrast", # Grayscale + contrast (second most effective)
            # OPTIMIZATION: Removed slow methods (clahe, morphology, gaussian_blur, etc.)
            # to ensure backend responds within 1.5s time budget
        ]

        all_results = []
        successful_method = None
        max_methods_to_try = 3  # Kept at 3 for quality, but with shorter timeout
        methods_tried = 0  # Track how many methods we've tried
        
        print(f"[BARCODE DEBUG] Starting barcode detection. Image size: {original_img.size}, pyzbar: {_PYZBAR_AVAILABLE}, OpenCV: {_OPENCV_AVAILABLE}, pylibdmtx: {_PYLIBDMTX_AVAILABLE}")
        
        # Strategy: Try pyzbar first (most reliable), then supplement with OpenCV and region scanning
        # Performance guardrails: stop once we have enough results (>=4) or time budget exceeded
        import time
        start_ts = time.time()
        def time_budget_exceeded():
            elapsed = time.time() - start_ts
            if elapsed > 1.2:  # Strict budget: 1.2s for safety (8s total timeout on frontend)
                print(f"[BARCODE DEBUG] Time budget exceeded ({elapsed:.2f}s), stopping early")
            return elapsed > 1.2
        if _PYZBAR_AVAILABLE:
            for i, method in enumerate(preprocessing_methods):
                if i >= max_methods_to_try:
                    break
                if time_budget_exceeded():
                    print("[BARCODE DEBUG] Time budget exceeded during pyzbar, stopping early")
                    break
                methods_tried = i + 1
                    
                try:
                    processed_img = _preprocess_image_for_barcode(original_img, method)
                    decoded = zbar_decode(processed_img, symbols=symbols)
                    
                    if decoded:
                        # Found barcodes with this method
                        print(f"[BARCODE DEBUG] pyzbar method '{method}' successfully decoded {len(decoded)} barcode(s)")
                        method_results = [
                            {
                                "text": (d.data.decode("utf-8", errors="ignore") if isinstance(d.data, (bytes, bytearray)) else str(d.data)),
                                "format": d.type,
                                "points": getattr(d, "polygon", None),
                                "preprocessing_method": f"pyzbar_{method}",
                            }
                            for d in decoded
                        ]
                        all_results.extend(method_results)
                        if successful_method is None:
                            successful_method = f"pyzbar_{method}"
                        
                        # Fast path: If original method found results, try region scanning for more barcodes
                        # This is especially useful for images with multiple barcodes
                        if method == "original" and len(all_results) > 0 and not time_budget_exceeded():
                            print(f"[BARCODE DEBUG] Found {len(all_results)} barcode(s) with original method")
                            # If we found 1-3 barcodes, try region scanning to find more (up to 4 total)
                            if len(all_results) < 4:
                                print(f"[BARCODE DEBUG] Trying region scanning to find additional barcodes...")
                                try:
                                    region_results = _detect_multiple_barcodes_region_scan(
                                        original_img, 
                                        zbar_decode, 
                                        symbols=symbols
                                    )
                                    for region_result in region_results:
                                        # Check if we already have this result
                                        if not any(r["text"] == region_result["text"] for r in all_results):
                                            region_result["preprocessing_method"] = f"region_scan_{method}"
                                            all_results.append(region_result)
                                            print(f"[BARCODE DEBUG] Region scan found additional barcode: {region_result['text']}")
                                            # Stop region scanning once we have 4 codes
                                            if len(all_results) >= 4:
                                                print(f"[BARCODE DEBUG] Found 4 barcodes total, stopping region scan")
                                                break
                                except Exception as e:
                                    print(f"[DEBUG] Region scanning failed: {e}")
                            
                            # Early exit if we found enough codes
                            if len(all_results) >= 4:
                                print(f"[BARCODE DEBUG] Found {len(all_results)} barcode(s), sufficient (pyzbar)")
                                break
                    else:
                        # Log when method doesn't find anything (for debugging difficult images)
                        if method in ["grayscale_contrast"]:
                            print(f"[BARCODE DEBUG] Method '{method}' tried but found no barcodes")
                except Exception as e:
                    # If one preprocessing method fails, continue with next
                    print(f"[DEBUG] Preprocessing method '{method}' failed: {e}")
                    continue
        else:
            print("[BARCODE DEBUG] pyzbar not available, skipping pyzbar detection")
        
        # Strategy: Supplement with OpenCV barcode detector if we found few results
        # OpenCV is particularly good at detecting multiple barcodes in one image
        # Try OpenCV if we found less than 4 barcodes, or if pyzbar found nothing/not available
        if (len(all_results) < 4 or (len(all_results) == 0 and (not _PYZBAR_AVAILABLE or methods_tried >= max_methods_to_try))) and _OPENCV_AVAILABLE and _OPENCV_BARCODE_DETECTOR is not None and not time_budget_exceeded():
            print(f"[BARCODE DEBUG] OpenCV supplement: found {len(all_results)} codes, trying for more...")
            try:
                import numpy as np
                # Convert PIL Image to OpenCV format (numpy array)
                img_array = np.array(original_img.convert("RGB"))
                img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                
                # Try with only essential preprocessing methods (original, high_contrast)
                opencv_methods = ["original", "high_contrast"]  # Minimal for speed
                for method in opencv_methods:
                    if time_budget_exceeded():
                        print("[BARCODE DEBUG] Time budget exceeded during OpenCV, stopping early")
                        break
                    if len(all_results) >= 4:  # Early exit if we have enough
                        print(f"[BARCODE DEBUG] OpenCV: Already have {len(all_results)} codes, stopping")
                        break
                    try:
                        processed_img = _preprocess_image_for_barcode(original_img, method)
                        img_cv = np.array(processed_img.convert("RGB"))
                        img_cv = cv2.cvtColor(img_cv, cv2.COLOR_RGB2BGR)
                        
                        # OpenCV barcode detector
                        # Note: detectAndDecode returns different number of values in different OpenCV versions
                        # OpenCV 4.5.1+: (retval, decoded_info, decoded_type, points)
                        # Some versions: (retval, decoded_info, decoded_type) - no points
                        result = _OPENCV_BARCODE_DETECTOR.detectAndDecode(img_cv)
                        
                        # Handle different return formats
                        if len(result) == 4:
                            retval, decoded_info, decoded_type, points = result
                        elif len(result) == 3:
                            retval, decoded_info, decoded_type = result
                            points = None
                        else:
                            print(f"[DEBUG] OpenCV method '{method}': Unexpected return format: {len(result)} values")
                            continue
                        
                        if retval and decoded_info:
                            print(f"[BARCODE DEBUG] OpenCV found {len(decoded_info)} barcode(s) with method '{method}'")
                            # Handle different formats for decoded_info (list vs single value)
                            if not isinstance(decoded_info, (list, tuple)):
                                decoded_info = [decoded_info]
                            if not isinstance(decoded_type, (list, tuple)):
                                decoded_type = [decoded_type]
                            if points is not None and not isinstance(points, (list, tuple)):
                                points = [points]
                            
                            for i, info in enumerate(decoded_info):
                                if info and info.strip():
                                    text = info.strip()
                                    # Check if we already have this result
                                    if not any(r["text"] == text for r in all_results):
                                        btype = decoded_type[i] if i < len(decoded_type) else None
                                        pts = points[i] if points and i < len(points) else None
                                        all_results.append({
                                            "text": text,
                                            "format": btype if btype else "UNKNOWN",
                                            "points": pts.tolist() if pts is not None and hasattr(pts, 'tolist') else None,
                                            "preprocessing_method": f"opencv_{method}",
                                        })
                                        if successful_method is None:
                                            successful_method = f"opencv_{method}"
                                        print(f"[BARCODE DEBUG] OpenCV found additional barcode: {text}")
                    except Exception as e:
                        print(f"[DEBUG] OpenCV method '{method}' failed: {e}")
                        continue
            except Exception as e:
                print(f"[DEBUG] OpenCV barcode detection failed: {e}")
        
        # Try ZXing-C++ (pyrxing or zxing-cpp) as additional engine
        # ZXing-C++ is fast and has no system dependencies, good for simple cases
        # Note: ZXing-C++ is better for simple cases but weaker for rotated/multiple barcodes
        if len(all_results) < 4 and (_PYRXING_AVAILABLE or _ZXING_CPP_AVAILABLE) and not time_budget_exceeded():
            print(f"[BARCODE DEBUG] ZXing-C++ supplement: found {len(all_results)} codes, trying for more...")
            try:
                import numpy as np
                
                # Try with a minimal preprocessing methods (ZXing-C++ is fast)
                zxing_methods = ["original", "high_contrast"]
                
                for method in zxing_methods:
                    if time_budget_exceeded():
                        print("[BARCODE DEBUG] Time budget exceeded during ZXing-C++, stopping early")
                        break
                    if len(all_results) >= 4:  # Early exit if we have enough
                        print(f"[BARCODE DEBUG] ZXing-C++: Already have {len(all_results)} codes, stopping")
                        break
                    try:
                        processed_img = _preprocess_image_for_barcode(original_img, method)
                        
                        results = []
                        if _PYRXING_AVAILABLE:
                            # Use pyrxing (better performance, no system dependencies)
                            # pyrxing.read_barcodes() expects PIL Image
                            try:
                                detected = pyrxing.read_barcodes(processed_img)
                                # pyrxing.read_barcodes() returns a list of DecodeResult objects
                                if detected:
                                    results = detected if isinstance(detected, list) else [detected]
                                    print(f"[DEBUG] ZXing-C++ method '{method}': found {len(results)} result(s)")
                            except Exception as e:
                                print(f"[DEBUG] ZXing-C++ method '{method}' failed: {e}")
                                continue
                        elif _ZXING_CPP_AVAILABLE:
                            # Use zxing-cpp (official binding)
                            try:
                                import numpy as np
                                # zxing_cpp.read_barcodes() expects numpy array
                                img_array = np.array(processed_img.convert("RGB"))
                                detected = zxing_cpp.read_barcodes(img_array)
                                # Handle single result or list
                                if detected:
                                    results = detected if isinstance(detected, list) else [detected]
                            except Exception as e:
                                print(f"[DEBUG] zxing-cpp read failed: {e}")
                                continue
                        
                        if results:
                            print(f"[BARCODE DEBUG] ZXing-C++ found {len(results)} barcode(s) with method '{method}'")
                            for result in results:
                                # Handle different result formats
                                try:
                                    if hasattr(result, 'text'):
                                        text = result.text
                                    elif hasattr(result, 'data'):
                                        text = result.data.decode('utf-8') if isinstance(result.data, bytes) else str(result.data)
                                    else:
                                        text = str(result)
                                    
                                    format_type = None
                                    if hasattr(result, 'format'):
                                        format_type = result.format
                                    elif hasattr(result, 'type'):
                                        format_type = result.type
                                    
                                    if text and text.strip():
                                        text = text.strip()
                                        # Check if we already have this result
                                        if not any(r["text"] == text for r in all_results):
                                            all_results.append({
                                                "text": text,
                                                "format": format_type if format_type else "UNKNOWN",
                                                "points": None,  # ZXing-C++ may not provide points
                                                "preprocessing_method": f"zxing_{method}",
                                            })
                                            if successful_method is None:
                                                successful_method = f"zxing_{method}"
                                            print(f"[BARCODE DEBUG] ZXing-C++ found additional barcode: {text}")
                                except Exception as e:
                                    print(f"[DEBUG] Error processing ZXing-C++ result: {e}")
                                    continue
                    except Exception as e:
                        print(f"[DEBUG] ZXing-C++ method '{method}' failed: {e}")
                        continue
            except Exception as e:
                print(f"[DEBUG] ZXing-C++ barcode detection failed: {e}")
        
        # DISABLED: pylibdmtx (Data Matrix) is slow and not needed for this project (Code 128 only)
        # This saves 1-3 seconds per backend call
        # if not all_results and _PYLIBDMTX_AVAILABLE and dmtx_decode is not None:
        #     print("[BARCODE DEBUG] No results from pyzbar, trying pylibdmtx for Data Matrix...")
        if False:  # Completely disabled - prevents accidental execution
            try:
                # Try with different preprocessing methods for Data Matrix
                # pylibdmtx works best with grayscale images
                # Limit to 3 methods to avoid timeout (pylibdmtx can be slow)
                methods_to_try = [
                    "original", "grayscale", "high_contrast"
                ]
                
                # Smart strategy for Data Matrix:
                # 1. Try original first (fast path for most cases)
                # 2. If original finds results, return immediately (single barcode case)
                # 3. If original finds 1-2 results, continue to find more (multiple barcodes case)
                # 4. Limit to 3 methods to avoid timeout
                found_any = False
                original_found_count = 0
                max_methods_to_try = 3  # Reduced to avoid timeout
                
                for i, method in enumerate(methods_to_try):
                    if i >= max_methods_to_try:
                        print(f"[BARCODE DEBUG] Reached max methods limit ({max_methods_to_try}), stopping")
                        break
                    
                    try:
                        print(f"[BARCODE DEBUG] Trying pylibdmtx with method '{method}'...")
                        processed_img = _preprocess_image_for_barcode(original_img, method)
                        # Convert to grayscale for better Data Matrix recognition
                        gray_img = processed_img.convert("L")
                        
                        # Try decoding with PIL Image first (faster)
                        print(f"[BARCODE DEBUG] Calling dmtx_decode with PIL Image (method: {method})...")
                        dmtx_results = dmtx_decode(gray_img)
                        print(f"[BARCODE DEBUG] dmtx_decode returned {len(dmtx_results) if dmtx_results else 0} result(s)")
                        
                        # If no results, try with numpy array (pylibdmtx sometimes works better with numpy)
                        if not dmtx_results:
                            try:
                                import numpy as np
                                # Convert PIL Image to numpy array
                                img_array = np.array(gray_img)
                                print(f"[BARCODE DEBUG] Trying dmtx_decode with numpy array (method: {method})...")
                                dmtx_results = dmtx_decode(img_array)
                                print(f"[BARCODE DEBUG] dmtx_decode (numpy) returned {len(dmtx_results) if dmtx_results else 0} result(s)")
                            except Exception as np_e:
                                # If numpy conversion fails, continue with next method
                                print(f"[DEBUG] numpy conversion failed for method '{method}': {np_e}")
                                continue
                        
                        if dmtx_results:
                            found_any = True
                            print(f"[BARCODE DEBUG] pylibdmtx found {len(dmtx_results)} Data Matrix code(s) with method '{method}'")
                            new_results_count = 0
                            for dmtx in dmtx_results:
                                text = dmtx.data.decode("utf-8", errors="ignore") if isinstance(dmtx.data, bytes) else str(dmtx.data)
                                # Check if we already have this result
                                if not any(r["text"] == text for r in all_results):
                                    all_results.append({
                                        "text": text,
                                        "format": "DATAMATRIX",
                                        "points": None,  # pylibdmtx doesn't provide polygon
                                        "preprocessing_method": method,
                                    })
                                    new_results_count += 1
                                    if successful_method is None:
                                        successful_method = f"pylibdmtx_{method}"
                            if new_results_count > 0:
                                print(f"[BARCODE DEBUG] Added {new_results_count} new Data Matrix code(s) from method '{method}' (total: {len(all_results)})")
                            
                            # Track how many codes original method found
                            if method == "original":
                                original_found_count = len(all_results)
                            
                            # Fast path: If original method found 3+ results, return immediately
                            # This handles most single-box or simple cases quickly
                            if method == "original" and len(all_results) >= 3:
                                print(f"[BARCODE DEBUG] Found {len(all_results)} Data Matrix code(s) with original method, returning immediately")
                                break
                            
                            # If original found 1-2 results, continue to find more (for multiple barcodes like barcode_004.jpg)
                            # But if we've found 4+ codes, likely found all, stop early
                            if len(all_results) >= 4:
                                print(f"[BARCODE DEBUG] Found {len(all_results)} Data Matrix codes, stopping early to avoid timeout")
                                break
                            
                            # If original found nothing, we'll try more methods (up to max_methods_to_try)
                            # If original found 1-2, continue trying but limit to avoid timeout
                            if method == "original" and original_found_count > 0 and original_found_count < 3:
                                # Continue trying other methods, but limit to 4 total methods
                                max_methods_to_try = min(max_methods_to_try, 4)
                                print(f"[BARCODE DEBUG] Original found {original_found_count} code(s), continuing to find more (max {max_methods_to_try} methods)")
                    except Exception as e:
                        print(f"[DEBUG] pylibdmtx method '{method}' failed: {e}")
                        continue
                
                if found_any:
                    print(f"[BARCODE DEBUG] Total Data Matrix codes found: {len(all_results)}")
            except Exception as e:
                print(f"[DEBUG] pylibdmtx decoding failed: {e}")

        # Remove duplicates (same text and format)
        seen = set()
        unique_results = []
        for r in all_results:
            key = (r["text"], r["format"])
            if key not in seen:
                seen.add(key)
                unique_results.append(r)

        if unique_results:
            print(f"[BARCODE DEBUG] Successfully decoded {len(unique_results)} unique barcode(s) using method '{successful_method}'")
            return {
                "count": len(unique_results),
                "results": unique_results,
                "successful_preprocessing_method": successful_method,
            }
        else:
            # No barcodes found with any method
            print(f"[BARCODE DEBUG] No barcodes found after trying {len(preprocessing_methods)} preprocessing methods")
            print(f"[BARCODE DEBUG] Image size: {original_img.size}, Format: {original_img.mode}")
            print(f"[BARCODE DEBUG] Tried methods: {', '.join(preprocessing_methods[:max_methods_to_try])}")
            print(f"[BARCODE DEBUG] OpenCV available: {_OPENCV_AVAILABLE}, Detector: {_OPENCV_BARCODE_DETECTOR is not None}")
            print(f"[BARCODE DEBUG] pylibdmtx available: {_PYLIBDMTX_AVAILABLE}")
            print(f"[BARCODE DEBUG] pyzbar available: {_PYZBAR_AVAILABLE}")
            return {
                "count": 0,
                "results": [],
                "successful_preprocessing_method": None,
            }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode: {e}")


@app.post("/parse-barcode")
async def parse_barcode_data(request: dict):
    """
    Parse barcode data to extract model, power (sphere), and sn (serial number).
    
    Input: 
    - Single: {"barcode_data": "YGOOD+22.50D"}
    - Multiple: {"barcode_data": ["SN24116011069", "YGOOD+22.50D"], "merge": true}
    
    Output: {"model": "YGOOD", "power": "+22.50D", "sn": "24116011069"}
    """
    from .barcode_parser import parse_barcode, merge_barcode_results, format_expiry_date
    
    barcode_data = request.get("barcode_data", "")
    merge = request.get("merge", False)
    
    # Debug logging
    print(f"[BARCODE DEBUG] Raw data: {barcode_data}")
    print(f"[BARCODE DEBUG] Merge: {merge}")
    
    if not barcode_data:
        raise HTTPException(status_code=400, detail="barcode_data is required")
    
    # Handle multiple barcodes
    if isinstance(barcode_data, list) and merge:
        parsed = merge_barcode_results(barcode_data)
    else:
        # Single barcode
        if isinstance(barcode_data, list):
            barcode_data = barcode_data[0]
        parsed = parse_barcode(barcode_data)
    
    return parsed


# ------------------------
# Invoice CRUD
# ------------------------
@app.post("/invoice", response_model=InvoiceOut, status_code=201)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    """Create a new invoice"""
    if payload.supplier_id is not None and not db.get(Supplier, payload.supplier_id):
        raise HTTPException(status_code=404, detail="Supplier not found")
    invoice = Invoice(
        upload_date=payload.upload_date or date.today(),
        invoice_number=payload.invoice_number,
        serial_number=payload.serial_number,
        supplier_id=payload.supplier_id,
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@app.get("/invoice", response_model=list[InvoiceOut])
def list_invoices(db: Session = Depends(get_db)):
    """List all invoices with is_matched status from lens table"""
    # Join invoice with lens table to get is_matched status
    # Also join with supplier table to get supplier name
    from sqlalchemy import outerjoin
    
    stmt = (
        select(
            Invoice.id,
            Invoice.upload_date,
            Invoice.invoice_number,
            Invoice.serial_number,
            Invoice.supplier_id,
            Supplier.name.label('supplier_name'),
            Lens.is_matched
        )
        .select_from(Invoice)
        .outerjoin(Supplier, Invoice.supplier_id == Supplier.id)
        .outerjoin(Lens, Invoice.serial_number == Lens.serial_number)
        .order_by(Invoice.id.desc())
    )
    
    results = db.execute(stmt).all()
    
    # Convert to list of dicts to match InvoiceOut schema
    invoices = [
        {
            "id": r.id,
            "upload_date": r.upload_date,
            "invoice_number": r.invoice_number,
            "serial_number": r.serial_number,
            "supplier_id": r.supplier_id,
            "supplier_name": r.supplier_name,
            "is_matched": r.is_matched
        }
        for r in results
    ]
    
    return invoices


@app.get("/invoice/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Get invoice by id"""
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@app.patch("/invoice/{invoice_id}", response_model=InvoiceOut)
def update_invoice(invoice_id: int, payload: InvoiceUpdate, db: Session = Depends(get_db)):
    """Update invoice"""
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.upload_date is not None:
        invoice.upload_date = payload.upload_date
    if payload.invoice_number is not None:
        invoice.invoice_number = payload.invoice_number
    if payload.serial_number is not None:
        invoice.serial_number = payload.serial_number
    if payload.supplier_id is not None:
        if not db.get(Supplier, payload.supplier_id):
            raise HTTPException(status_code=404, detail="Supplier not found")
        invoice.supplier_id = payload.supplier_id

    db.commit()
    db.refresh(invoice)
    return invoice


@app.delete("/invoice/{invoice_id}")
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Delete invoice"""
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    db.delete(invoice)
    db.commit()
    return {"deleted": True, "id": invoice_id}


@app.delete("/invoice/by-number/{invoice_number}")
def delete_invoice_by_number(invoice_number: str, db: Session = Depends(get_db)):
    """Delete all invoice records with the given invoice number"""
    invoices = db.execute(
        select(Invoice).filter(Invoice.invoice_number == invoice_number)
    ).scalars().all()
    
    if not invoices:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    deleted_count = len(invoices)
    for invoice in invoices:
        db.delete(invoice)
    
    db.commit()
    return {"message": f"Deleted {deleted_count} invoice records", "deleted_count": deleted_count}


# ------------------------
# Move To Clinic
# ------------------------
@app.post("/lens/{lens_id}/move-to-clinic", response_model=ReceivedLensOut)
def move_lens_to_clinic(lens_id: int, payload: MoveToClinicRequest, db: Session = Depends(get_db)):
    """
    Move lens to a new clinic.
    When moving, the current site is set as move_from_clinic,
    and the new clinic is set as site.
    """
    lens = db.get(Lens, lens_id)
    if not lens:
        raise HTTPException(status_code=404, detail="Lens not found")

    # Set current site as move_from_clinic (only if there's a current site)
    if lens.site:
        lens.move_from_clinic = lens.site

    # Set new clinic as site (must already exist; do not auto-create)
    site_id = resolve_site_id(db, payload.new_clinic)
    if site_id is None:
        raise HTTPException(status_code=404, detail="Site not found")
    lens.site_id = site_id

    db.commit()
    db.refresh(lens)
    return lens
@app.post("/barcode/extract-sn-smart")
async def extract_serial_number_smart(request: dict):
    """
    Intelligently extract serial number, type, and power from barcode string using learned patterns and heuristics.
    No external API calls - all processing is done locally.
    
    Input: {"barcode": "DCB000023520820525250628"}
    Output: {
        "serial_number": "2082052525",
        "type": "DCB00",
        "power": "+22.50D",
        "confidence": "high",
        "method": "smart_local"
    }
    """
    from .barcode_parser import smart_extract_serial_number
    
    barcode = (request.get("barcode") or "").strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="barcode is required")
    
    try:
        result = smart_extract_serial_number(barcode)
        return {
            "serial_number": result.get("sn"),
            "type": result.get("type"),
            "power": result.get("power"),
            "confidence": result.get("confidence", "medium"),
            "method": "smart_local"
        }
    except Exception as e:
        print(f"[SMART PARSER ERROR] Failed: {e}")
        # Fallback to basic parsing
        from .barcode_parser import parse_barcode
        parsed = parse_barcode(barcode)
        return {
            "serial_number": parsed.get("sn"),
            "type": parsed.get("model"),
            "power": parsed.get("power"),
            "confidence": "low",
            "method": "fallback_basic"
        }


@app.post("/barcode/learn")
async def learn_barcode_pattern(request: dict):
    """
    Learn a new barcode pattern from a barcode-serial_number pair.
    Optionally learns type and power information.
    
    Input: {
        "barcode": "DCB000023520820525250628",
        "serial_number": "2082052525",
        "type": "DCB00",  # optional
        "power": "+22.50D"  # optional
    }
    Output: {"success": True, "message": "Pattern learned successfully"}
    """
    from .barcode_learner import learn_from_example
    
    barcode = (request.get("barcode") or "").strip()
    serial_number = (request.get("serial_number") or "").strip()
    type_value = request.get("type")
    type = type_value.strip() if type_value else None
    power_value = request.get("power")
    power = power_value.strip() if power_value else None
    
    if not barcode or not serial_number:
        raise HTTPException(status_code=400, detail="barcode and serial_number are required")
    
    try:
        is_new = learn_from_example(barcode, serial_number, type, power)
        return {
            "success": True,
            "message": "New pattern learned" if is_new else "Pattern updated",
            "is_new": is_new
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to learn pattern: {str(e)}")


@app.get("/barcode/patterns")
async def get_learned_patterns():
    """
    Get all learned barcode patterns.
    
    Output: List of learned patterns with examples and match counts
    """
    from .barcode_learner import get_learned_patterns
    
    try:
        patterns = get_learned_patterns()
        return {"patterns": patterns, "count": len(patterns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get patterns: {str(e)}")


@app.delete("/barcode/patterns/{pattern_id}")
async def delete_learned_pattern(pattern_id: int):
    """
    Delete a learned pattern by ID.
    
    Output: {"success": true, "message": "Pattern deleted"}
    """
    from .barcode_learner import delete_pattern
    
    try:
        success = delete_pattern(pattern_id)
        if success:
            return {"success": True, "message": "Pattern deleted"}
        else:
            raise HTTPException(status_code=404, detail="Pattern not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete pattern: {str(e)}")


# ------------------------
# OCR Endpoints
# ------------------------
@app.post("/ocr/extract-lens-info")
async def ocr_extract_lens_info(
    image: UploadFile = File(...),
    extract_model: bool = True,
    extract_power: bool = True,
    extract_sn: bool = False,
    debug: bool = False
):
    """
    Extract lens information (model, power) from box label image using OCR.
    
    This is useful when barcode doesn't contain all information.
    For example, in the attached image:
    - Barcode contains: Serial Number (50483779011)
    - OCR needed for: Model (AN6VMT3), Power (+18.5C+3.00D)
    
    Args:
        image: Image file of lens box label
        extract_model: Extract model (default: True)
        extract_power: Extract power/sphere (default: True)
        extract_sn: Extract serial number (default: False, usually from barcode)
    
    Returns:
        {
            "success": bool,
            "model": str or None,
            "power": str or None,
            "sn": str or None,
            "confidence": float,
            "ocr_engine": str,
            "raw_text": list,
            "error": str or None
        }
    """
    try:
        from .ocr_processor import extract_lens_info_from_image
        
        # Read image
        content = await image.read()
        img = Image.open(BytesIO(content))
        
        # Extract information
        result = extract_lens_info_from_image(
            img,
            extract_model=extract_model,
            extract_power=extract_power,
            extract_sn=extract_sn
        )
        
        return {
            "success": True,
            **result,
            "error": None
        }
    
    except Exception as e:
        print(f"[OCR] Extraction failed with error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "model": None,
            "power": None,
            "sn": None,
            "confidence": 0.0,
            "ocr_engine": None,
            "raw_text": [],
            "error": str(e)
        }


@app.post("/scan-lens-box")
async def scan_lens_box(image: UploadFile = File(...)):
    """
    Complete lens box scanning workflow:
    1. Decode barcodes to get serial number
    2. Use OCR to extract model and power from label
    
    This provides a complete solution for scanning lens boxes where:
    - Barcode contains serial number
    - Label text contains model and power information
    
    Returns:
        {
            "success": bool,
            "barcode": {
                "sn": str,
                "count": int,
                "results": list
            },
            "ocr": {
                "model": str,
                "power": str,
                "confidence": float
            },
            "complete": bool,  # True if all fields found
            "error": str or None
        }
    """
    try:
        from .ocr_processor import extract_lens_info_from_image
        
        # Read image once
        content = await image.read()
        img = Image.open(BytesIO(content))
        
        # Step 1: Decode barcode for serial number
        # Reuse existing barcode decode logic
        barcode_result = {
            "sn": None,
            "count": 0,
            "results": []
        }
        
        if _PYZBAR_AVAILABLE:
            try:
                # Try barcode decode
                symbols = [
                    ZBarSymbol.CODE128,
                    ZBarSymbol.QRCODE,
                    ZBarSymbol.DATABAR,
                ]
                decoded = zbar_decode(img, symbols=symbols)
                
                if decoded:
                    barcode_result["count"] = len(decoded)
                    barcode_result["results"] = [
                        {
                            "text": d.data.decode("utf-8", errors="ignore") if isinstance(d.data, bytes) else str(d.data),
                            "format": d.type
                        }
                        for d in decoded
                    ]
                    
                    # Parse first barcode for SN
                    if decoded:
                        from .barcode_parser import parse_barcode
                        first_barcode = decoded[0].data.decode("utf-8", errors="ignore")
                        parsed = parse_barcode(first_barcode)
                        barcode_result["sn"] = parsed.get("sn")
            except Exception as e:
                print(f"[SCAN] Barcode decode failed: {e}")
        
        # Step 2: OCR for model and power
        ocr_result = extract_lens_info_from_image(
            img,
            extract_model=True,
            extract_power=True,
            extract_sn=False  # We get SN from barcode
        )
        
        # Check if we have complete information
        complete = bool(
            barcode_result["sn"] and
            ocr_result["model"] and
            ocr_result["power"]
        )
        
        return {
            "success": True,
            "barcode": barcode_result,
            "ocr": {
                "model": ocr_result["model"],
                "power": ocr_result["power"],
                "confidence": ocr_result["confidence"],
                "engine": ocr_result["ocr_engine"]
            },
            "complete": complete,
            "error": None
        }
    
    except Exception as e:
        return {
            "success": False,
            "barcode": None,
            "ocr": None,
            "complete": False,
            "error": str(e)
        }
