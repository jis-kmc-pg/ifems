#!/bin/bash

# Dynamic Resolution API Test Script
# Created: 2026-02-28
# Purpose: Test all 4 interval levels and error cases

BASE_URL="http://localhost:4000/api"
FACILITY_ID="HNK10-000"
START_TIME="2024-01-01T00:00:00Z"
END_TIME="2024-01-01T23:59:59Z"

echo "🧪 Dynamic Resolution API Test Suite"
echo "===================================="
echo ""

# Test 1: 15분 interval (Level 0) - Power
echo "📊 Test 1: 15분 interval (Level 0) - Power"
curl -s "${BASE_URL}/facilities/${FACILITY_ID}/power/range?startTime=${START_TIME}&endTime=${END_TIME}&interval=15m" \
  | jq '.metadata | {interval, totalPoints, zoomLevel}'
echo ""

# Test 2: 1분 interval (Level 1) - Power
echo "📊 Test 2: 1분 interval (Level 1) - Power"
curl -s "${BASE_URL}/facilities/${FACILITY_ID}/power/range?startTime=${START_TIME}&endTime=${END_TIME}&interval=1m" \
  | jq '.metadata | {interval, totalPoints, zoomLevel}'
echo ""

# Test 3: 10초 interval (Level 2) - Air (1시간만)
echo "📊 Test 3: 10초 interval (Level 2) - Air (1시간)"
curl -s "${BASE_URL}/facilities/${FACILITY_ID}/air/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T01:00:00Z&interval=10s" \
  | jq '.metadata | {interval, totalPoints, zoomLevel}'
echo ""

# Test 4: 1초 interval (Level 3) - Air (1시간, maxPoints 제한)
echo "📊 Test 4: 1초 interval (Level 3) - Air (1시간, maxPoints=1000)"
curl -s "${BASE_URL}/facilities/${FACILITY_ID}/air/range?startTime=2024-01-01T00:00:00Z&endTime=2024-01-01T01:00:00Z&interval=1s&maxPoints=1000" \
  | jq '.metadata | {interval, totalPoints, returnedPoints, downsampled, zoomLevel}'
echo ""

# Test 5: Data sample (첫 3개 데이터 포인트)
echo "📊 Test 5: Data sample (첫 3개 포인트)"
curl -s "${BASE_URL}/facilities/${FACILITY_ID}/power/range?startTime=${START_TIME}&endTime=${END_TIME}&interval=1m" \
  | jq '.data[0:3]'
echo ""

# Error Test 1: Invalid interval
echo "❌ Error Test 1: Invalid interval (5m)"
curl -s "${BASE_URL}/facilities/${FACILITY_ID}/power/range?startTime=${START_TIME}&endTime=${END_TIME}&interval=5m" \
  | jq '{statusCode, message, error}'
echo ""

# Error Test 2: Invalid time range
echo "❌ Error Test 2: Invalid time range (end < start)"
curl -s "${BASE_URL}/facilities/${FACILITY_ID}/power/range?startTime=2024-01-02T00:00:00Z&endTime=2024-01-01T00:00:00Z&interval=1m" \
  | jq '{statusCode, message, error}'
echo ""

# Error Test 3: Facility not found
echo "❌ Error Test 3: Facility not found (INVALID-000)"
curl -s "${BASE_URL}/facilities/INVALID-000/power/range?startTime=${START_TIME}&endTime=${END_TIME}&interval=1m" \
  | jq '{statusCode, message, error}'
echo ""

echo "✅ All tests completed!"
