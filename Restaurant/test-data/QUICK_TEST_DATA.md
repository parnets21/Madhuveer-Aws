# Quick Test Data Reference

## 🚀 Quick Start - Copy & Paste Ready Data

### 1️⃣ Create Store Locations

**POST** `/api/v1/hotel/store-location`

```json
{"name": "Main Store", "address": "123 Restaurant Street", "manager": "John Manager", "contact": "9876543210"}
{"name": "Kitchen Store", "address": "456 Kitchen Avenue", "manager": "Jane Kitchen", "contact": "9876543211"}
{"name": "Cold Storage", "address": "789 Storage Road", "manager": "Bob Storage", "contact": "9876543212"}
```

---

### 2️⃣ Create Raw Materials

**POST** `/api/v1/hotel/raw-material`

```json
{"name": "Tomatoes", "category": "Vegetables", "unit": "kg", "minLevel": 10, "description": "Fresh red tomatoes"}
{"name": "Cheese", "category": "Dairy", "unit": "kg", "minLevel": 5, "description": "Mozzarella cheese"}
{"name": "Flour", "category": "Grains", "unit": "kg", "minLevel": 20, "description": "All-purpose flour"}
{"name": "Onions", "category": "Vegetables", "unit": "kg", "minLevel": 15, "description": "Fresh onions"}
{"name": "Chicken", "category": "Meat", "unit": "kg", "minLevel": 8, "description": "Fresh chicken"}
```

---

### 3️⃣ Create Suppliers

**POST** `/api/v1/hotel/res-supplier/add`

```json
{
  "name": "Rajesh Kumar",
  "companyName": "Fresh Vegetables Supply Co.",
  "contact": "9876543210",
  "email": "rajesh@freshveg.com",
  "billingAddress": "123 Vegetable Market, City, State 12345",
  "gst": "GST123456789",
  "pan": "ABCDE1234F"
}
```

```json
{
  "name": "Mohan Dairy",
  "companyName": "Mohan Dairy Products Ltd.",
  "contact": "9876543211",
  "email": "mohan@dairy.com",
  "billingAddress": "456 Dairy Street, City, State 12345",
  "gst": "GST987654321",
  "pan": "FGHIJ5678K"
}
```

```json
{
  "name": "Grain Suppliers Inc",
  "companyName": "Premium Grain Suppliers",
  "contact": "9876543212",
  "email": "grain@suppliers.com",
  "billingAddress": "789 Grain Road, City, State 12345",
  "gst": "GST456789123",
  "pan": "LMNOP9012Q"
}
```

---

### 4️⃣ Create Purchase Order (Pending)

**POST** `/api/v1/hotel/purchase-orders`

**⚠️ Replace IDs with actual IDs from previous steps**

```json
{
  "supplierId": "YOUR_SUPPLIER_ID",
  "supplierName": "Fresh Vegetables Supply Co.",
  "branch": {
    "id": "YOUR_BRANCH_ID",
    "name": "Main Branch",
    "address": "123 Restaurant Street"
  },
  "categoryId": "YOUR_CATEGORY_ID",
  "categoryName": "Vegetables",
  "storeLocationId": "YOUR_STORE_LOCATION_ID",
  "storeLocation": {
    "id": "YOUR_STORE_LOCATION_ID",
    "name": "Main Store"
  },
  "storeType": "Main Store",
  "orderDate": "2024-01-15",
  "deliveryDate": "2024-01-22",
  "status": "Pending",
  "paymentStatus": "Pending",
  "items": [
    {
      "name": "YOUR_TOMATOES_RAW_MATERIAL_ID",
      "quantity": 50,
      "unit": "kg",
      "rate": 40,
      "amount": 2000
    },
    {
      "name": "YOUR_ONIONS_RAW_MATERIAL_ID",
      "quantity": 30,
      "unit": "kg",
      "rate": 35,
      "amount": 1050
    }
  ],
  "subtotal": 3050,
  "tax": 549,
  "total": 3599,
  "taxRate": 18,
  "notes": "Urgent delivery required",
  "paymentTerms": "Net 30"
}
```

---

### 5️⃣ Create GRN

**POST** `/api/v1/hotel/grn`

**⚠️ Replace IDs with actual IDs**

```json
{
  "supplier": "Fresh Vegetables Supply Co.",
  "supplierId": "YOUR_SUPPLIER_ID",
  "branch": "Main Branch",
  "branchId": "YOUR_BRANCH_ID",
  "poId": "YOUR_PO_ID",
  "storeType": "Main Store",
  "items": [
    {
      "product": "Tomatoes",
      "description": "Fresh red tomatoes",
      "quantity": 50,
      "unit": "kg",
      "rate": 40,
      "amount": 2000,
      "gstRate": 18,
      "category": "Vegetables",
      "storeType": "Main Store"
    },
    {
      "product": "Onions",
      "description": "Fresh onions",
      "quantity": 30,
      "unit": "kg",
      "rate": 35,
      "amount": 1050,
      "gstRate": 18,
      "category": "Vegetables",
      "storeType": "Main Store"
    }
  ],
  "totalQuantity": 80,
  "totalTax": 549,
  "totalAmount": 3599,
  "status": "Pending",
  "notes": "Items received in good condition",
  "receivedBy": "Store Manager"
}
```

---

### 6️⃣ Approve GRN (Auto-inwards stock)

**POST** `/api/v1/hotel/grn/{grnId}/approve`

```json
{
  "approvedBy": "Admin"
}
```

---

## 📋 Test All Routes

### Suppliers Routes
- ✅ `GET /api/v1/hotel/res-supplier` - List all
- ✅ `GET /api/v1/hotel/res-supplier/{id}` - Get one
- ✅ `POST /api/v1/hotel/res-supplier/add` - Create
- ✅ `PUT /api/v1/hotel/res-supplier/{id}` - Update
- ✅ `DELETE /api/v1/hotel/res-supplier/{id}` - Delete

### Purchase Orders Routes
- ✅ `GET /api/v1/hotel/purchase-orders` - List all
- ✅ `GET /api/v1/hotel/purchase-orders/pending` - Pending only
- ✅ `GET /api/v1/hotel/purchase-orders/stats` - Statistics
- ✅ `GET /api/v1/hotel/purchase-orders/{id}` - Get one
- ✅ `GET /api/v1/hotel/purchase-orders/{id}/grns` - Get linked GRNs
- ✅ `POST /api/v1/hotel/purchase-orders` - Create
- ✅ `PUT /api/v1/hotel/purchase-orders/{id}` - Update
- ✅ `PATCH /api/v1/hotel/purchase-orders/{id}/status` - Update status
- ✅ `PATCH /api/v1/hotel/purchase-orders/{id}/payment-status` - Update payment
- ✅ `DELETE /api/v1/hotel/purchase-orders/{id}` - Delete

### GRN Routes
- ✅ `GET /api/v1/hotel/grn` - List all
- ✅ `GET /api/v1/hotel/grn/{id}` - Get one
- ✅ `GET /api/v1/hotel/grn/number/{grnNumber}` - Get by number
- ✅ `GET /api/v1/hotel/grn/stats` - Statistics
- ✅ `POST /api/v1/hotel/grn` - Create
- ✅ `PUT /api/v1/hotel/grn/{id}` - Update
- ✅ `POST /api/v1/hotel/grn/{id}/approve` - Approve (inwards stock)
- ✅ `POST /api/v1/hotel/grn/{id}/reject` - Reject
- ✅ `DELETE /api/v1/hotel/grn/{id}` - Delete

### Store Location Routes
- ✅ `GET /api/v1/hotel/store-location` - List all
- ✅ `GET /api/v1/hotel/store-location/{id}` - Get one
- ✅ `POST /api/v1/hotel/store-location` - Create
- ✅ `PUT /api/v1/hotel/store-location/{id}` - Update
- ✅ `DELETE /api/v1/hotel/store-location/{id}` - Delete

---

## 🎯 Frontend Routes to Test

1. **Suppliers Tab**
   - URL: `/restaurant/purchase/res-supplier`
   - Should show: All suppliers list, Add/Edit/Delete buttons

2. **Purchase Orders Tab**
   - URL: `/restaurant/purchase/purchase-orders`
   - Should show: All POs, status badges, payment status

3. **GRN Tab**
   - URL: `/restaurant/purchase/GRN`
   - Should show: All GRNs, approve/reject buttons

4. **Pending POs Tab**
   - URL: `/restaurant/purchase/pending`
   - Should show: Only pending/in-transit POs

5. **Vendor Payment Tracking**
   - URL: `/restaurant/purchase/purchase-vendors`
   - Should show: Vendor payments and invoices

6. **Store Location**
   - URL: `/restaurant/purchase/store-location`
   - Should show: All store locations

---

## ✅ Verification Checklist

After creating test data, verify:

- [ ] Suppliers appear in Suppliers tab
- [ ] Purchase Orders appear in Purchase Orders tab
- [ ] Pending POs appear in Pending POs tab
- [ ] GRNs appear in GRN tab
- [ ] Store Locations appear in Store Location page
- [ ] After approving GRN, stock is added to inventory
- [ ] PO status updates work
- [ ] Payment status updates work
- [ ] Search and filters work in frontend
- [ ] Statistics show correct numbers

---

## 🔍 Quick API Test Commands (using curl or Postman)

```bash
# Get all suppliers
curl http://localhost:3000/api/v1/hotel/res-supplier

# Get pending POs
curl http://localhost:3000/api/v1/hotel/purchase-orders/pending

# Get PO stats
curl http://localhost:3000/api/v1/hotel/purchase-orders/stats

# Get all GRNs
curl http://localhost:3000/api/v1/hotel/grn

# Get all store locations
curl http://localhost:3000/api/v1/hotel/store-location
```

---

**Note:** Replace `localhost:3000` with your actual backend URL (e.g., `https://hotelviratbackend-1spr.onrender.com`)






