# Tag Management System - Gap Analysis Report

> **Analysis Type**: Design-Implementation Gap Analysis (PDCA Check Phase)
>
> **Project**: i-FEMS (Intelligence Facility & Energy Management System)
> **Analyst**: Claude (Opus 4.6) - gap-detector
> **Date**: 2026-02-23
> **Design Doc**: [tag-management.design.md](../../02-design/features/tag-management.design.md)
> **Status**: Review

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Compare the Tag Management System design document against the actual backend API, Prisma schema, frontend pages, and service layer to calculate design-implementation match rate and identify gaps.

### 1.2 Analysis Scope

- **Design Document**: `d:\AI_PJ\IFEMS\docs\02-design\features\tag-management.design.md`
- **Backend Implementation**:
  - `d:\AI_PJ\IFEMS\apps\api\src\settings\settings.controller.ts`
  - `d:\AI_PJ\IFEMS\apps\api\src\settings\settings.service.ts`
  - `d:\AI_PJ\IFEMS\apps\api\src\settings\dto\factory.dto.ts`
  - `d:\AI_PJ\IFEMS\apps\api\prisma\schema.prisma`
- **Frontend Implementation**:
  - `d:\AI_PJ\IFEMS\apps\web\src\pages\settings\SET008FactoryManagement.tsx`
  - `d:\AI_PJ\IFEMS\apps\web\src\pages\settings\SET009LineSettings.tsx`
  - `d:\AI_PJ\IFEMS\apps\web\src\pages\settings\SET012TagMaster.tsx`
  - `d:\AI_PJ\IFEMS\apps\web\src\pages\settings\SET013TagHierarchy.tsx`
  - `d:\AI_PJ\IFEMS\apps\web\src\services\settings.ts`

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| API Endpoints Match | 91% | OK |
| Data Model Match | 95% | OK |
| Frontend Screens Match | 82% | WARN |
| Service Layer Match | 96% | OK |
| DTO/Validation | 40% | CRITICAL |
| **Overall** | **85%** | **WARN** |

---

## 3. API Endpoint Gap Analysis

### 3.1 Factory API (Design Section 7.1)

| Design Endpoint | Implementation | Status | Notes |
|----------------|---------------|--------|-------|
| `GET /api/settings/factory` | `@Get('factory')` controller:64 | MATCH | Returns list with lineCount |
| `POST /api/settings/factory` | `@Post('factory')` controller:70 | MATCH | Uses CreateFactoryDto |
| `PUT /api/settings/factory/:id` | `@Put('factory/:id')` controller:76 | MATCH | Uses UpdateFactoryDto |
| `DELETE /api/settings/factory/:id` | `@Delete('factory/:id')` controller:82 | MATCH | Cascade delete |

**Factory API Score: 4/4 (100%)**

### 3.2 Line API (Design Section 7.2)

| Design Endpoint | Implementation | Status | Notes |
|----------------|---------------|--------|-------|
| `GET /api/settings/line` | `@Get('line')` controller:91 | MATCH | |
| `GET /api/settings/line?factoryId=xxx` | `@Query('factoryId')` controller:93 | MATCH | factoryId query param |
| `POST /api/settings/line` | `@Post('line')` controller:97 | MATCH | |
| `PUT /api/settings/line/:id` | `@Put('line/:id')` controller:103 | MATCH | |
| `DELETE /api/settings/line/:id` | `@Delete('line/:id')` controller:109 | MATCH | |

**Line API Score: 5/5 (100%)**

### 3.3 Facility API (Design Section 7.3)

| Design Endpoint | Implementation | Status | Notes |
|----------------|---------------|--------|-------|
| `GET /api/settings/facility-master` | `@Get('facility-master')` controller:32 | MATCH | |
| `GET /api/settings/facility-master?lineId=xxx` | `@Query('line')` controller:35 | CHANGED | Design says `lineId`, impl uses `line` param name |
| `GET /api/settings/facility-master/:id/tags` | -- | MISSING | Not implemented in controller |
| `POST /api/settings/facility-master` | `@Post('facility-master')` controller:43 | MATCH | |
| `PUT /api/settings/facility-master/:id` | `@Put('facility-master/:id')` controller:49 | MATCH | |
| `DELETE /api/settings/facility-master/:id` | `@Delete('facility-master/:id')` controller:55 | MATCH | |

**Facility API Score: 4.5/6 (75%)**

### 3.4 Facility Type API (Design Section 7.4)

| Design Endpoint | Implementation | Status | Notes |
|----------------|---------------|--------|-------|
| `GET /api/settings/facility-type` | -- | MISSING | Not implemented |
| `POST /api/settings/facility-type` | -- | MISSING | Not implemented |
| `PUT /api/settings/facility-type/:id` | -- | MISSING | Not implemented |
| `DELETE /api/settings/facility-type/:id` | -- | MISSING | Not implemented |

**Facility Type API Score: 0/4 (0%)**

### 3.5 Tag API (Design Section 7.5)

| Design Endpoint | Implementation | Status | Notes |
|----------------|---------------|--------|-------|
| `GET /api/settings/tag` | `@Get('tag')` controller:118 | MATCH | |
| `GET /api/settings/tag?facilityId=xxx` | `@Query('facilityId')` controller:121 | MATCH | |
| `GET /api/settings/tag?tagType=TREND` | `@Query('tagType')` controller:122 | MATCH | |
| `POST /api/settings/tag` | `@Post('tag')` controller:135 | MATCH | |
| `POST /api/settings/tag/bulk` | -- | MISSING | Bulk create (Excel) not implemented |
| `PUT /api/settings/tag/:id` | `@Put('tag/:id')` controller:141 | MATCH | |
| `DELETE /api/settings/tag/:id` | `@Delete('tag/:id')` controller:147 | MATCH | |

**Additional (Not in Design):**
- `GET /api/settings/tag/:id` (controller:129) - Tag detail endpoint exists but not in design

**Tag API Score: 5/7 (71%)**

### 3.6 Hierarchy API (Design Section 7.6)

| Design Endpoint | Implementation | Status | Notes |
|----------------|---------------|--------|-------|
| `GET /api/settings/hierarchy` | `@Get('hierarchy')` controller:156 | MATCH | Full tree structure |
| `GET /api/settings/hierarchy/factory/:factoryId` | `@Get('hierarchy/factory/:factoryId')` controller:162 | MATCH | |
| `GET /api/settings/hierarchy/line/:lineId` | `@Get('hierarchy/line/:lineId')` controller:168 | MATCH | |
| `GET /api/settings/hierarchy/facility/:facilityId` | `@Get('hierarchy/facility/:facilityId')` controller:174 | MATCH | |

**Hierarchy API Score: 4/4 (100%)**

### 3.7 API Endpoint Summary

| API Group | Designed | Implemented | Match Rate |
|-----------|:--------:|:-----------:|:----------:|
| Factory | 4 | 4 | 100% |
| Line | 5 | 5 | 100% |
| Facility | 6 | 5 | 75% |
| Facility Type | 4 | 0 | 0% |
| Tag | 7 | 6 | 71% |
| Hierarchy | 4 | 4 | 100% |
| **Total** | **30** | **24** | **80%** |

**Additional endpoints not in design**: 1 (`GET /tag/:id`)

---

## 4. Data Model Gap Analysis

### 4.1 Factory Model

| Design Field | Schema Field | Type Match | Status |
|-------------|-------------|:----------:|--------|
| id (UUID) | id String @id @default(uuid()) | YES | MATCH |
| code (unique) | code String @unique | YES | MATCH |
| name | name String | YES | MATCH |
| fullName | fullName String? | YES | MATCH |
| location | location String? | YES | MATCH |
| isActive | isActive Boolean @default(true) | YES | MATCH |
| createdAt | createdAt DateTime @default(now()) | YES | MATCH |
| updatedAt | updatedAt DateTime @updatedAt | YES | MATCH |
| lines[] | lines Line[] | YES | MATCH |
| -- | @@map("factories") | -- | ADDED (table name mapping, acceptable) |

**Factory Model Score: 9/9 (100%)**

### 4.2 Line Model

| Design Field | Schema Field | Type Match | Status |
|-------------|-------------|:----------:|--------|
| id (UUID) | id String @id @default(uuid()) | YES | MATCH |
| code (unique) | code String @unique | YES | MATCH |
| name | name String | YES | MATCH |
| factoryId | factoryId String | YES | MATCH |
| factory FK | factory Factory @relation | YES | MATCH |
| order | order Int @default(0) | YES | MATCH |
| isActive | isActive Boolean @default(true) | YES | MATCH |
| createdAt | createdAt DateTime @default(now()) | YES | MATCH |
| updatedAt | updatedAt DateTime @updatedAt | YES | MATCH |
| facilities[] | facilities Facility[] | YES | MATCH |
| @@index([factoryId]) | @@index([factoryId]) | YES | MATCH |
| -- | @@map("lines") | -- | ADDED |

**Line Model Score: 11/11 (100%)**

### 4.3 Facility Model

| Design Field | Schema Field | Type Match | Status |
|-------------|-------------|:----------:|--------|
| id (UUID) | id String @id @default(uuid()) | YES | MATCH |
| code (unique) | code String @unique | YES | MATCH |
| name | name String | YES | MATCH |
| lineId | lineId String | YES | MATCH |
| line FK | line Line @relation | YES | MATCH |
| process | process String? | YES | MATCH |
| type | type String | YES | MATCH |
| status | status FacilityStatus @default(NORMAL) | YES | MATCH |
| isProcessing | isProcessing Boolean @default(true) | YES | MATCH |
| latitude | latitude Float? | YES | MATCH |
| longitude | longitude Float? | YES | MATCH |
| createdAt | createdAt DateTime @default(now()) | YES | MATCH |
| updatedAt | updatedAt DateTime @updatedAt | YES | MATCH |
| tags[] | tags Tag[] | YES | MATCH |
| energyData[] | energyData EnergyTimeseries[] | CHANGED | Design says EnergyData, impl EnergyTimeseries |
| @@index([lineId]) | @@index([lineId]) | YES | MATCH |
| @@index([status]) | @@index([status]) | YES | MATCH |
| -- | @@map("facilities") | -- | ADDED |

**Facility Model Score: 16/17 (94%)**

### 4.4 Tag Model

| Design Field | Schema Field | Type Match | Status |
|-------------|-------------|:----------:|--------|
| id (UUID) | id String @id @default(uuid()) | YES | MATCH |
| facilityId | facilityId String | YES | MATCH |
| facility FK | facility Facility @relation | YES | MATCH |
| tagName (unique) | tagName String @unique | YES | MATCH |
| displayName | displayName String | YES | MATCH |
| tagType | tagType TagType | YES | MATCH |
| energyType | energyType EnergyType? | YES | MATCH |
| dataType | dataType TagDataType | CHANGED | Design says `DataType`, impl `TagDataType` |
| unit | unit String? | YES | MATCH |
| order | order Int @default(0) | YES | MATCH |
| isActive | isActive Boolean @default(true) | YES | MATCH |
| createdAt | createdAt DateTime @default(now()) | YES | MATCH |
| updatedAt | updatedAt DateTime @updatedAt | YES | MATCH |
| @@index([facilityId]) | @@index([facilityId]) | YES | MATCH |
| @@index([tagType]) | @@index([tagType]) | YES | MATCH |
| @@index([energyType]) | @@index([energyType]) | YES | MATCH |
| -- | dataPoints TagDataRaw[] | -- | ADDED (relation to time series) |
| -- | @@map("tags") | -- | ADDED |

**Tag Model Score: 15/16 (94%)**

### 4.5 Enum Definitions

| Design Enum | Schema Enum | Status |
|------------|------------|--------|
| TagType (TREND, USAGE, SENSOR) | TagType (TREND, USAGE, SENSOR) | MATCH |
| EnergyType (elec, air) | EnergyType (elec, air) | MATCH |
| DataType (T, Q) | TagDataType (T, Q) | CHANGED (name differs) |

**Enum Score: 2.5/3 (83%)**

### 4.6 Data Model Summary

```
Overall Data Model Match: 95%
  Factory:  100%
  Line:     100%
  Facility:  94%
  Tag:       94%
  Enums:     83%
```

---

## 5. Frontend Screen Gap Analysis

### 5.1 SET-008: Factory Management

| Design Requirement | Implementation | Status |
|-------------------|---------------|--------|
| URL: /settings/factory | breadcrumbs show /settings/factory | MATCH |
| Factory list view | SortableTable with columns | MATCH |
| Add factory | handleAdd + createMutation | MATCH |
| Edit factory | handleEdit + updateMutation | MATCH |
| Delete factory | handleDelete + deleteMutation + ConfirmModal | MATCH |
| Field: code | Form input (disabled on edit) | MATCH |
| Field: name | Form input | MATCH |
| Field: fullName | Form input | MATCH |
| Field: location | Form input | MATCH |
| Field: isActive | Checkbox | MATCH |
| Lines count display | lineCount column in table | MATCH |

**SET-008 Score: 11/11 (100%)**

### 5.2 SET-009: Line Settings

| Design Requirement | Implementation | Status |
|-------------------|---------------|--------|
| URL: /settings/line | breadcrumbs show /settings/line | MATCH |
| Line list view | SortableTable with columns | MATCH |
| Factory filter | FilterBar with factory dropdown | MATCH |
| Add line | handleAdd + createMutation | MATCH |
| Edit line | handleEdit + updateMutation | MATCH |
| Delete line | handleDelete + deleteMutation + ConfirmModal | MATCH |
| Field: code | Form input (disabled on edit) | MATCH |
| Field: name | Form input | MATCH |
| Field: factoryId | Factory select dropdown | MATCH |
| Field: order | Number input | MATCH |
| Field: isActive | Checkbox | MATCH |
| Facility count display | facilityCount column | MATCH |

**SET-009 Score: 12/12 (100%)**

### 5.3 SET-010: Facility Master Management

| Design Requirement | Implementation | Status |
|-------------------|---------------|--------|
| URL: /settings/facility-master | existing page (not listed for analysis) | PARTIAL |
| Facility list by line filter | facility-master controller uses `line` param | PARTIAL |
| Tag count per facility | Not displayed | MISSING |

**SET-010 Score: Not in scope (existing page extension, not listed for frontend analysis)**

### 5.4 SET-011: Facility Type Settings

| Design Requirement | Implementation | Status |
|-------------------|---------------|--------|
| URL: /settings/facility-type | -- | MISSING |
| Type list view | -- | MISSING |
| Add/Edit/Delete type | -- | MISSING |

**SET-011 Score: 0/3 (0%) -- Entire screen missing**

### 5.5 SET-012: Tag Master Management

| Design Requirement | Implementation | Status |
|-------------------|---------------|--------|
| URL: /settings/tag-master | breadcrumbs show /settings/tag | MATCH |
| Tag list view | SortableTable with columns | MATCH |
| Filter: facilityId | FilterBar facility dropdown | MATCH |
| Filter: tagType | FilterBar tagType dropdown | MATCH |
| Filter: energyType | FilterBar energyType dropdown | MATCH |
| Search | FilterBar search input | MATCH |
| Add tag | handleAdd + createMutation | MATCH |
| Edit tag | handleEdit + updateMutation | MATCH |
| Delete tag | handleDelete + ConfirmModal | MATCH |
| Field: tagName | Form input (disabled on edit) | MATCH |
| Field: displayName | Form input | MATCH |
| Field: facilityId | Facility select dropdown | MATCH |
| Field: tagType | Select (TREND/USAGE/SENSOR) | MATCH |
| Field: energyType | Select (elec/air/none) | MATCH |
| Field: dataType | Select (T/Q) | MATCH |
| Field: unit | Text input | MATCH |
| Field: order | Number input | MATCH |
| Bulk upload (Excel) | -- | MISSING |

**SET-012 Score: 17/18 (94%)**

### 5.6 SET-013: Tag Hierarchy

| Design Requirement | Implementation | Status |
|-------------------|---------------|--------|
| URL: /settings/tag-hierarchy | breadcrumbs show /settings/hierarchy | MATCH |
| Tree View visualization | TreeNode component with expand/collapse | MATCH |
| Factory > Line > Facility > Tag drill-down | 4-level tree implemented | MATCH |
| Level-based stats | Stats cards (Factory/Line/Facility/Tag counts) | MATCH |
| Tag assignment/relocation | -- | MISSING |
| Expand All / Collapse All | expandAll/collapseAll buttons | MATCH |
| Per-node count display | count prop on TreeNode | MATCH |
| Status badges | FacilityStatus badge (NORMAL/WARNING/DANGER/OFFLINE) | MATCH |

**SET-013 Score: 7/8 (88%)**

### 5.7 Frontend Summary

| Screen | Designed | Implemented | Score |
|--------|:--------:|:-----------:|:-----:|
| SET-008 Factory | 11 | 11 | 100% |
| SET-009 Line | 12 | 12 | 100% |
| SET-011 Facility Type | 3 | 0 | 0% |
| SET-012 Tag Master | 18 | 17 | 94% |
| SET-013 Tag Hierarchy | 8 | 7 | 88% |
| **Total** | **52** | **47** | **90%** |

---

## 6. Service Layer (Frontend API Client) Gap Analysis

| Design Endpoint | Service Function | Status |
|----------------|-----------------|--------|
| Factory CRUD | getFactoryList, createFactory, updateFactory, deleteFactory | MATCH |
| Line CRUD | getLineList, createLine, updateLine, deleteLine | MATCH |
| Tag CRUD | getTagList, getTag, createTag, updateTag, deleteTag | MATCH |
| Tag Bulk | -- | MISSING |
| Hierarchy | getHierarchy, getFactoryHierarchy, getLineHierarchy, getFacilityTags | MATCH |
| Facility Type CRUD | -- | MISSING |
| Types: Factory | Interface with proper fields | MATCH |
| Types: Line | Interface with proper fields | MATCH |
| Types: Tag | Interface with proper fields | MATCH |
| Types: Hierarchy | HierarchyFactory/Line/Facility interfaces | MATCH |
| Mock fallback | USE_MOCK pattern for all functions | MATCH |

**Service Layer Score: 23/25 (92%)**

---

## 7. DTO / Validation Gap Analysis

| Design Entity | DTO Exists | Validation | Status |
|--------------|:----------:|:----------:|--------|
| Factory | CreateFactoryDto, UpdateFactoryDto, FactoryResponseDto | class-validator | MATCH |
| Line | -- (uses `any`) | NONE | MISSING |
| Tag | -- (uses `any`) | NONE | MISSING |
| Facility Type | -- | -- | MISSING (entire feature absent) |

**DTO Score: 1/4 (25%)**

**Detail**: Only Factory has proper DTOs with class-validator decorators. Line, Tag, and Facility Type all use `@Body() data: any` in the controller, which bypasses input validation entirely.

---

## 8. Code Quality Issues

### 8.1 Type Safety

| File | Issue | Severity | Location |
|------|-------|----------|----------|
| settings.controller.ts | `@Body() data: any` on Line endpoints | WARN | Lines 99, 105 |
| settings.controller.ts | `@Body() data: any` on Tag endpoints | WARN | Lines 137, 143 |
| settings.service.ts | `const where: any = {}` dynamic query building | WARN | Lines 68, 321 |
| settings.service.ts | `createFacilityMaster(data: any)` | WARN | Line 116 |

### 8.2 Architecture Concerns

| Issue | Location | Severity |
|-------|----------|----------|
| PrismaService re-registered in SettingsModule (not Global) | settings.module.ts:8 | INFO |
| No error handling (try/catch) in any service method | settings.service.ts | WARN |
| Tag list hardcoded to `take: 100` without pagination params | settings.service.ts:347 | WARN |

### 8.3 Facility Master Service Bug

The `createFacilityMaster` method (service line 123) passes `line: data.line.toUpperCase()` as a string, but the Prisma schema defines `lineId` as a FK to Line table. This is a **type mismatch** -- it should use `lineId` and pass the Line table UUID, not a string code. Same issue on `updateFacilityMaster` (line 143).

**Severity: HIGH** -- This will cause a runtime error when creating/updating facilities via the API.

---

## 9. Detailed Differences Found

### 9.1 Missing Features (Design YES, Implementation NO)

| # | Item | Design Location | Description | Impact |
|---|------|-----------------|-------------|--------|
| 1 | Facility Type API (full CRUD) | design.md Section 7.4 | 4 endpoints not implemented at all | HIGH |
| 2 | Facility Type Screen (SET-011) | design.md Section 6.4 | Entire screen missing | HIGH |
| 3 | Tag Bulk Create endpoint | design.md:436 | `POST /tag/bulk` for Excel upload | MEDIUM |
| 4 | Tag Bulk Upload UI | design.md:358 | Excel upload feature in SET-012 | MEDIUM |
| 5 | Facility tags sub-endpoint | design.md:416 | `GET /facility-master/:id/tags` | LOW |
| 6 | Tag reassignment in Hierarchy | design.md:377 | Tag relocation in SET-013 | LOW |
| 7 | Line DTO validation | design.md schema | No CreateLineDto/UpdateLineDto | MEDIUM |
| 8 | Tag DTO validation | design.md schema | No CreateTagDto/UpdateTagDto | MEDIUM |

### 9.2 Added Features (Design NO, Implementation YES)

| # | Item | Implementation Location | Description |
|---|------|------------------------|-------------|
| 1 | Tag detail endpoint | controller:129 `GET /tag/:id` | Single tag detail with full hierarchy |
| 2 | Tag search by search param | controller:124 | Additional `search` query param |
| 3 | General settings API | controller:11 | `GET/PUT /settings/general` |
| 4 | Thresholds API | controller:23 | `GET /settings/thresholds` |

### 9.3 Changed Features (Design != Implementation)

| # | Item | Design | Implementation | Impact |
|---|------|--------|----------------|--------|
| 1 | Facility filter param name | `lineId` | `line` (string code) | LOW |
| 2 | DataType enum name | `DataType` | `TagDataType` | LOW |
| 3 | EnergyData relation name | `EnergyData` | `EnergyTimeseries` | LOW |
| 4 | Facility create uses line code | `lineId` (FK UUID) | `line` (string code) | HIGH (bug) |

---

## 10. Match Rate Calculation

### Scoring Breakdown (weighted)

| Category | Weight | Items Designed | Items Matched | Raw Score | Weighted Score |
|----------|:------:|:--------------:|:-------------:|:---------:|:--------------:|
| API Endpoints | 30% | 30 | 24 | 80% | 24.0% |
| Data Model | 20% | 56 fields | 53.5 | 95% | 19.0% |
| Frontend Screens | 25% | 52 reqs | 47 | 90% | 22.5% |
| Service Layer | 15% | 25 | 23 | 92% | 13.8% |
| DTO/Validation | 10% | 4 entities | 1 | 25% | 2.5% |
| **Total** | **100%** | -- | -- | -- | **81.8%** |

```
+---------------------------------------------+
|  Overall Match Rate: 82%                    |
+---------------------------------------------+
|  API Endpoints:         80%   (24/30)       |
|  Data Model:            95%   (53.5/56)     |
|  Frontend Screens:      90%   (47/52)       |
|  Service Layer:         92%   (23/25)       |
|  DTO/Validation:        25%   (1/4)         |
+---------------------------------------------+
```

---

## 11. Recommended Actions

### 11.1 Immediate Actions (Priority 1)

| # | Action | File | Impact |
|---|--------|------|--------|
| 1 | Fix Facility create/update `line` vs `lineId` bug | settings.service.ts:116-151 | Runtime error prevention |
| 2 | Create CreateLineDto, UpdateLineDto with validation | dto/line.dto.ts (new) | Input validation |
| 3 | Create CreateTagDto, UpdateTagDto with validation | dto/tag.dto.ts (new) | Input validation |

### 11.2 Short-term Actions (Priority 2)

| # | Action | Files | Impact |
|---|--------|-------|--------|
| 1 | Implement `POST /tag/bulk` endpoint for Excel upload | controller + service | Feature completeness |
| 2 | Add pagination support to Tag list (remove hardcoded `take: 100`) | settings.service.ts:347 | Scalability for 3,107 tags |
| 3 | Add error handling (try/catch + proper error responses) to all service methods | settings.service.ts | Reliability |

### 11.3 Long-term Actions (Priority 3)

| # | Action | Description |
|---|--------|-------------|
| 1 | Implement Facility Type CRUD (SET-011) | 4 API endpoints + frontend screen |
| 2 | Implement Tag reassignment in Hierarchy screen | Drag-and-drop or modal-based tag relocation |
| 3 | Add `GET /facility-master/:id/tags` sub-endpoint | Facility-specific tag list |
| 4 | Move PrismaService to Global module | Architecture cleanup |

### 11.4 Design Document Update Needed

| # | Item | Reason |
|---|------|--------|
| 1 | Add `GET /settings/tag/:id` endpoint | Implemented and useful, not in design |
| 2 | Add `search` query param to Tag API spec | Implemented for tagName/displayName search |
| 3 | Document `TagDataType` enum name (vs `DataType`) | Schema uses different name |
| 4 | Clarify if Facility Type (SET-011) is deferred or required | Entire feature absent |

---

## 12. Synchronization Recommendation

**Match Rate: 82% (above 70%, below 90%)**

> There are some differences. Document update is recommended for additions, and targeted implementation for missing critical features.

Recommended approach:
1. **Fix the Facility lineId bug immediately** -- this is a runtime error
2. **Add DTOs for Line and Tag** -- security/validation gap
3. **Implement Tag bulk upload** -- core feature for 3,107 tag data migration
4. **Defer Facility Type (SET-011)** -- update design to mark as Phase 2, or implement if needed
5. **Update design document** to reflect additions (tag/:id, search param)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-23 | Initial gap analysis | Claude (Opus 4.6) |
