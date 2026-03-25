# app/models.py

from sqlalchemy import Column, Integer, String, Boolean, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import date
from .database import Base


class Company(Base):
    __tablename__ = "company"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)

    types = relationship("LensType", back_populates="company")

    def __repr__(self) -> str:
        return f"<Company(id={self.id}, name='{self.name}')>"


class Supplier(Base):
    __tablename__ = "supplier"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)

    invoices = relationship("Invoice", back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier(id={self.id}, name='{self.name}')>"


class Site(Base):
    __tablename__ = "site"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True, index=True)

    lenses = relationship("Lens", back_populates="site_ref")

    def __repr__(self) -> str:
        return f"<Site(id={self.id}, name='{self.name}')>"


class LensType(Base):
    __tablename__ = "lens_type"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("company.id"), nullable=False, index=True)

    company = relationship("Company", back_populates="types")
    lenses = relationship("Lens", back_populates="lens_type")

    def __repr__(self) -> str:
        return (
            f"<LensType(id={self.id}, name='{self.name}', company_id={self.company_id})>"
        )


class Invoice(Base):
    """
    Invoice table to store invoice information.
    """
    __tablename__ = "invoice"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Invoice attributes
    upload_date = Column(Date, nullable=False, default=date.today)
    invoice_number = Column(String(200), nullable=False, index=True)
    serial_number = Column(String(100), nullable=False, index=True)  # SN from invoice
    supplier_id = Column(Integer, ForeignKey("supplier.id"), nullable=True, index=True)

    # Relationships
    supplier = relationship("Supplier", back_populates="invoices")
    lenses = relationship("Lens", back_populates="invoice")

    def __repr__(self) -> str:
        return (
            f"<Invoice(id={self.id}, "
            f"invoice_number='{self.invoice_number}', "
            f"serial_number='{self.serial_number}', "
            f"supplier='{self.supplier_name}', "
            f"upload_date={self.upload_date})>"
        )

    @property
    def supplier_name(self) -> str | None:
        return self.supplier.name if self.supplier else None


class Lens(Base):
    """
    Core entity: one lens per serial number.

    This model represents the unified lens entity for the MVP.
    All lifecycle states (received / matched / used) are tracked
    directly on this table.
    """
    __tablename__ = "lens"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Business key (one SN = one lens)
    serial_number = Column(String(100), nullable=False, unique=True, index=True)

    # Status flags
    is_used = Column(Boolean, nullable=False, default=False)
    is_matched = Column(Boolean, nullable=False, default=False)
    used_date = Column(Date, nullable=True)

    # Lens attributes (kept flexible for real-world data)
    type_id = Column(Integer, ForeignKey("lens_type.id"), nullable=True, index=True)
    power = Column(Text, nullable=True)

    # Receiving metadata
    received_date = Column(Date, nullable=False, default=date.today)
    site_id = Column(Integer, ForeignKey("site.id"), nullable=True, index=True)
    
    # Move-from clinic information
    move_from_clinic = Column(Text, nullable=True)  # Previous clinic before move, default is empty
    
    # Foreign key to Invoice
    invoice_id = Column(Integer, ForeignKey("invoice.id"), nullable=True, index=True)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="lenses")
    lens_type = relationship("LensType", back_populates="lenses")
    site_ref = relationship("Site", back_populates="lenses")

    @property
    def type(self) -> str | None:
        return self.lens_type.name if self.lens_type else None

    @property
    def site(self) -> str | None:
        return self.site_ref.name if self.site_ref else None

    @property
    def company(self) -> str | None:
        if not self.lens_type or not self.lens_type.company:
            return None
        return self.lens_type.company.name

    def __repr__(self) -> str:
        return (
            f"<Lens(id={self.id}, "
            f"serial_number='{self.serial_number}', "
            f"is_used={self.is_used}, "
            f"is_matched={self.is_matched}, "
            f"used_date={self.used_date}, "
            f"received_date={self.received_date}, "
            f"site='{self.site}', "
            f"company='{self.company}', "
            f"move_from_clinic='{self.move_from_clinic}', "
            f"invoice_id={self.invoice_id})>"
        )
