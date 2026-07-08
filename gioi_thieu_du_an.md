# 🌍 Travel Planner with AI Assistant

## 📖 Giới thiệu

Travel Planner with AI Assistant là hệ thống hỗ trợ người dùng lập kế hoạch du lịch trên **Website** và **Mobile App**.

Người dùng có thể chủ động tìm kiếm địa điểm, khách sạn, nhà hàng và tự xây dựng lịch trình theo nhu cầu của mình.

Ngoài ra, hệ thống tích hợp **AI Assistant** giúp người dùng tham khảo lịch trình, tối ưu kế hoạch và đưa ra các gợi ý phù hợp dựa trên dữ liệu có sẵn trong hệ thống.

> AI không thay thế người dùng lập kế hoạch mà chỉ đóng vai trò như một trợ lý hỗ trợ.

---

# 🎯 Mục tiêu

- Xây dựng hệ thống Website và Mobile App hoàn chỉnh.
- Quản lý dữ liệu du lịch.
- Hỗ trợ người dùng lập kế hoạch du lịch.
- Ứng dụng AI để nâng cao trải nghiệm người dùng.

---

# 🛠 Công nghệ sử dụng

## Frontend Web

- ReactJS (Vite)
- React Router
- Axios
- Tailwind CSS

---

## Mobile App

- React Native
- Expo
- React Navigation
- Axios

---

## Backend

- NodeJS
- ExpressJS
- JWT Authentication
- Bcrypt
- Multer

---

## Database

- MongoDB
- Mongoose

---

## AI

- Google Gemini API

---

## Cloud Storage

- Cloudinary

---

## Map

- OpenStreetMap

---

# 👥 Phân quyền

## Customer

Người sử dụng hệ thống.

## Admin

Quản trị dữ liệu.

---

# 🌐 WEBSITE

## Customer

### Authentication

- Đăng ký
- Đăng nhập
- Đăng xuất

---

### Hồ sơ

- Quản lý thông tin cá nhân
- Đổi mật khẩu
- Đổi ảnh đại diện

---

### Khám phá

- Xem danh sách thành phố
- Xem địa điểm du lịch
- Xem khách sạn
- Xem nhà hàng
- Xem quán cafe
- Xem chi tiết địa điểm

---

### Tìm kiếm

- Theo tên
- Theo thành phố
- Theo danh mục
- Theo mức giá

---

### Lập kế hoạch chuyến đi

- Tạo chuyến đi
- Chọn ngày đi
- Chọn ngày về
- Thêm địa điểm vào lịch trình
- Xóa địa điểm
- Sắp xếp lại lịch trình
- Lưu chuyến đi
- Chỉnh sửa chuyến đi
- Xóa chuyến đi

---

### AI Travel Assistant

- Gợi ý lịch trình
- Tối ưu lịch trình hiện có
- Gợi ý địa điểm phù hợp
- Gợi ý khách sạn
- Gợi ý nhà hàng
- Ước tính tổng chi phí

---

### Review

- Đánh giá địa điểm
- Chấm sao
- Viết nhận xét

---

### Favorites

- Lưu địa điểm yêu thích
- Lưu khách sạn yêu thích
- Lưu nhà hàng yêu thích

---

## Admin

### Dashboard

- Thống kê người dùng
- Thống kê chuyến đi
- Thống kê địa điểm
- Thống kê đánh giá

---

### Quản lý người dùng

- CRUD User

---

### Quản lý thành phố

- CRUD City

---

### Quản lý địa điểm

- CRUD Attraction

---

### Quản lý khách sạn

- CRUD Hotel

---

### Quản lý nhà hàng

- CRUD Restaurant

---

### Quản lý quán cafe

- CRUD Cafe

---

### Quản lý đánh giá

- Xem review
- Xóa review

---

> Dữ liệu do Admin quản lý sẽ được lưu trong MongoDB và được AI sử dụng để đưa ra các gợi ý phù hợp.

---

# 📱 MOBILE APP

## Customer

### Authentication

- Đăng nhập
- Đăng ký

---

### Trang chủ

- Gợi ý địa điểm nổi bật
- Chuyến đi sắp tới
- Địa điểm yêu thích

---

### Khám phá

- Tìm kiếm địa điểm
- Tìm kiếm khách sạn
- Tìm kiếm nhà hàng
- Xem thông tin chi tiết
- Lưu yêu thích

---

### Chuyến đi

- Xem lịch trình
- Check-in địa điểm
- Theo dõi tiến độ chuyến đi
- Đánh dấu địa điểm đã tham quan

---

### Bản đồ

- Xem vị trí địa điểm
- Chỉ đường

---

### AI Travel Assistant

- Điều chỉnh lịch trình
- Gợi ý địa điểm gần vị trí hiện tại
- Gợi ý địa điểm thay thế
- Ước tính chi phí phát sinh

---

### Nhật ký chuyến đi

- Đăng ảnh
- Ghi chú
- Đánh giá chuyến đi

---

### Hồ sơ

- Quản lý tài khoản
- Lịch sử chuyến đi

---

# 🤖 AI Workflow

Người dùng có thể sử dụng hệ thống theo hai cách:

### Cách 1 (Không sử dụng AI)

- Tự tìm kiếm địa điểm
- Tự tạo lịch trình
- Tự chỉnh sửa lịch trình

---

### Cách 2 (Có AI hỗ trợ)

Người dùng nhập:

- Thành phố
- Ngân sách
- Số ngày
- Sở thích
- Yêu cầu thêm

↓

Backend truy vấn dữ liệu từ MongoDB

↓

Gửi dữ liệu đến Gemini API

↓

Gemini sinh gợi ý lịch trình

↓

Người dùng có thể chỉnh sửa lại lịch trình theo ý muốn

---

# 🗂 Database Collections

- users
- cities
- attractions
- hotels
- restaurants
- cafes
- trips
- itineraries
- reviews
- favorites

---

# 🚀 Hướng phát triển

- Chia sẻ lịch trình với bạn bè
- Lập kế hoạch du lịch theo nhóm
- Đề xuất theo thời tiết
- Đăng nhập Google
- AI cá nhân hóa lịch trình
- Đồng bộ Google Calendar



