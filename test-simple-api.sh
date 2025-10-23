#!/bin/bash
# Simple API testing script

echo "🧪 Testing Client & Lender API Endpoints"
echo ""

# Test 1: Client Registration
echo "📝 Test 1: Client Registration"
REGISTER_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "http://localhost:3000/api/client/register" \
  -X POST \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "email": "testclient@gmail.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "555-1234",
  "dealerId": "ee56c306-cc40-4dd9-8e86-ef11b313455a"
}
EOF
)

HTTP_BODY=$(echo "$REGISTER_RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$REGISTER_RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "Status: $HTTP_STATUS"
echo "Response: $HTTP_BODY"
echo ""

# Extract token for subsequent requests
TOKEN=$(echo "$HTTP_BODY" | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ Registration successful! Token: ${TOKEN:0:20}..."
    echo ""

    # Test 2: Client Login
    echo "🔐 Test 2: Client Login"
    curl -s "http://localhost:3000/api/client/login" \
      -X POST \
      -H "Content-Type: application/json" \
      -d '{"email":"testclient@gmail.com","password":"SecurePass123"}' | jq '.'
    echo ""

    # Test 3: Get Client Profile
    echo "👤 Test 3: Get Client Profile"
    curl -s "http://localhost:3000/api/client/profile" \
      -H "Authorization: Bearer $TOKEN" | jq '.'
    echo ""

    # Test 4: Get Client Applications
    echo "📄 Test 4: Get Client Applications"
    curl -s "http://localhost:3000/api/client/applications" \
      -H "Authorization: Bearer $TOKEN" | jq '.'
    echo ""

    # Test 5: Get Active Lenders
    echo "🏦 Test 5: Get Active Lenders"
    curl -s "http://localhost:3000/api/lenders?active=true" \
      -H "Authorization: Bearer $TOKEN" | jq '.'
    echo ""

    echo "✅ ALL TESTS COMPLETED!"
else
    echo "❌ Registration failed!"
fi
