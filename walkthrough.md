# Hoàn thiện 12 hạng mục Backend Developer (BE-01 ➔ BE-12)

Đã hoàn thành triển khai, tối ưu và kiểm thử toàn bộ 12 hạng mục kỹ thuật Backend dựa trên tài liệu đặc tả [02-backend-developer-fix-spec.md](file:///d:/mkt-hub-backend/BE/02-backend-developer-fix-spec.md) và phản hồi nghiệp vụ [fix_ui_cn.txt](file:///d:/mkt-hub-backend/BE/fix_ui_cn.txt).

---

## Danh sách chi tiết các hạng mục đã hoàn thành

### Nhóm 1: Quản lý Dự án & Tasks (BE-01 ➔ BE-05)
1. **BE-01: Cho phép tạo dự án không bắt buộc Budget / KPI ban đầu**
   - Đã cập nhật [project.dto.ts](file:///d:/mkt-hub-backend/BE/src/modules/projects-tasks/dto/project.dto.ts) gắn `@IsOptional()` cho các trường ngân sách và KPI.
2. **BE-02: Tự động tính Tuần / Năm / Thời lượng thực hiện & Validate thứ tự ngày**
   - Đã thêm tiện ích ISO week và tính số tuần `calcDurationWeeks` trong [date.util.ts](file:///d:/mkt-hub-backend/BE/src/common/utils/date.util.ts).
   - [tasks.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/projects-tasks/tasks.service.ts): Tự động tính `execWeek` và `execYear` từ `dueDate` khi không truyền; validate `dueDate >= startDate` ném lỗi `BadRequestException` rõ ràng; trả về `durationWeeks` trên `PresentedTask`.
3. **BE-03: Cập nhật người phụ trách (assigneeId) có kiểm tra Active status**
   - [tasks.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/projects-tasks/tasks.service.ts): Cho phép cập nhật `assigneeId`, kiểm tra người phụ trách tồn tại và `isActive === true`.
4. **BE-04: Động hóa danh sách Bên liên quan (Stakeholders)**
   - Cập nhật [task.dto.ts](file:///d:/mkt-hub-backend/BE/src/modules/projects-tasks/dto/task.dto.ts) từ enum cứng sang `@IsString({ each: true })`.
5. **BE-05: Lọc danh sách Task theo Project ID**
   - Hỗ trợ tham số `projectId` trong query filters để lọc danh sách task theo từng dự án độc lập.

---

### Nhóm 2: Leads & Kế hoạch KPI (BE-06 ➔ BE-07)
6. **BE-06: Kế hoạch KPI 12 tháng & Áp dụng tổng năm (Atomic Transaction)**
   - Schema Prisma: Thêm model [KpiMonthlyPlan](file:///d:/mkt-hub-backend/BE/prisma/schema.prisma) với ràng buộc duy nhất `@@unique([year, month])`.
   - API endpoints trong [leads-kpis.controller.ts](file:///d:/mkt-hub-backend/BE/src/modules/leads-kpis/leads-kpis.controller.ts) & [leads-kpis.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/leads-kpis/leads-kpis.service.ts):
     - `GET /v1/leads-kpis/plan/:year/months`: Lấy kế hoạch 12 tháng, tổng 12 tháng, mục tiêu năm hiện tại và độ lệch `diff`.
     - `PUT /v1/leads-kpis/plan/:year/months`: Lưu/cập nhật kế hoạch 12 tháng.
     - `POST /v1/leads-kpis/plan/:year/apply-monthly-total`: Ghi đè tổng 12 tháng thành mục tiêu năm nguyên tử trong `$transaction` và ghi nhật ký kiểm toán `AuditLog`.
7. **BE-07: Tùy chỉnh ngày ký hợp đồng / đóng deal (`signedDate` / `closedDate`)**
   - [leads-kpis.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/leads-kpis/leads-kpis.service.ts): Cho phép truyền `signedDate` tùy chỉnh khi đóng Opportunity won và tạo ClosedDeal; báo cáo tự động lọc theo `closedDate`.

---

### Nhóm 3: Kho & Quản lý Chi phí (BE-08 ➔ BE-11)
8. **BE-08: Quản lý VAT cho Kho vật phẩm (Trước VAT, % VAT, Sau VAT)**
   - Schema Prisma: Bổ sung `unitPriceBeforeVat`, `vatRate`, `unitPriceAfterVat` vào `InventoryBatch` và `InventoryTransaction`.
   - [inventory.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/inventory/inventory.service.ts): Tự động tính `unitPriceAfterVat = round(beforeVat * (1 + vatRate / 100))`.
9. **BE-09 & BE-10: Liên kết Dòng chi phí với Kho & Danh mục Tự do ("Khác")**
   - Schema Prisma: Thêm trường `categoryId`, `inventoryItemId`, `plannedQuantity`, `actualQuantity`, `unitPriceBeforeVatSnapshot`, `vatRateSnapshot`, `unitPriceAfterVatSnapshot`, `isCustom` vào `ExpenseLine`.
   - [expense.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/expense/expense.service.ts):
     - Khi lưu dòng chi phí có `inventoryItemId`: Tự động trừ tồn kho theo cơ chế FIFO trong `$transaction`, ghi nhận giao dịch xuất kho và lưu snapshot giá kèm VAT.
     - Khi cập nhật/xóa dòng chi phí: Tự động hoàn lại hoặc điều chỉnh số lượng tồn kho tương ứng.
     - Hỗ trợ danh mục "Khác" (`isCustom = true`): Nhập trực tiếp đơn giá, số lượng không cần liên kết vật phẩm kho.
10. **BE-11: Báo cáo Chi phí & Phân quyền Truy cập**
    - [expense.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/expense/expense.service.ts):
      - Ngân sách `budgetTotal` được tính chuẩn xác từ `SUM(plannedAmount)` của các dòng chi phí.
      - Chi phí thực tế `actualTotal` từ `SUM(actualAmount)`.
      - Bổ sung các chỉ số tổng trước/sau VAT `plannedTotalBeforeVat`, `plannedTotalAfterVat`, `actualTotalBeforeVat`, `actualTotalAfterVat`.
      - Ẩn các ID kỹ thuật không cần thiết trong bảng danh sách dự án.
    - [expense.controller.ts](file:///d:/mkt-hub-backend/BE/src/modules/expense/expense.controller.ts): Gắn `@Roles(Role.manager)` vào `GET /overview` và `GET /report`, chặn Specialist với lỗi 403 Forbidden.

---

### Nhóm 4: Quản trị Cấu hình Dropdown (BE-12)
11. **BE-12: Quản lý Danh mục Dropdown Tùy chỉnh & Phân tích Tác động**
    - Schema Prisma: Bổ sung model `DropdownOption` với trường `normalizedLabel` và chỉ mục `@@unique([dropdownKey, normalizedLabel])` chống trùng lặp không phân biệt hoa thường.
    - [data-management.controller.ts](file:///d:/mkt-hub-backend/BE/src/modules/data-management/data-management.controller.ts) & [data-management.service.ts](file:///d:/mkt-hub-backend/BE/src/modules/data-management/data-management.service.ts):
      - `GET /v1/data-management/dropdowns`: Trả về danh sách dropdown kèm toàn bộ options.
      - `POST /v1/data-management/dropdowns/:key/options`: Thêm tùy chọn mới vào khóa dropdown (kiểm tra trùng lặp case-insensitive độc lập theo từng key).
      - `PATCH /v1/data-management/dropdowns/:key/options/:optionId`: Đổi tên / thay đổi trạng thái kích hoạt của tùy chọn.
      - `DELETE /v1/data-management/dropdowns/:key/options/:optionId`: Xóa mềm tùy chọn.
      - `GET /v1/data-management/dropdowns/:key/options/:optionId/impact`: Kiểm tra và trả về số lượng bản ghi (Tasks, Projects, Deals, Opportunities, Expenses) đang sử dụng tùy chọn này trước khi người dùng xác nhận xóa.

---

## Kết quả Kiểm thử & Build

- **Lệnh build**: `npm run build` ➔ **Thành công (0 lỗi)**
- **Bộ kiểm thử tự động**: `npm test` ➔ **18 test suites passed, 129 tests passed (100%)**
