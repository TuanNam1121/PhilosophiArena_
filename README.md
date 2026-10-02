# Lăng Kính · Philosophy Arena

> Một vấn đề. Nhiều cách nhìn. Tự bạn đi đến kết luận.

Prototype Arena cho đồ án môn học. Sáu nhà tư tưởng cùng hiện diện; nhóm được chọn nêu quan điểm rồi trao đổi, trả lời và phản biện nhau. Người dùng chủ yếu theo dõi, có thể tham gia nếu muốn, mở X-Ray và viết lập trường của mình. Court và Socratic trong tài liệu thiết kế chưa được triển khai thành mode riêng.

## Chạy dự án

Yêu cầu Node.js và npm.

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Kết nối AI

Tạo file `.env` ở thư mục gốc:

```env
OPENAI_API_KEY=your_api_key
AI_MODEL=gpt-6-luna
```

Không đưa giá trị key lên Git. Nếu chưa có key, Arena vẫn chạy bằng lời thoại mẫu để xem luồng giao diện.

Lời thoại AI là mô phỏng lăng kính tư tưởng, không phải trích dẫn lịch sử.

## Philosophy X-Ray

X-Ray truy hồi trên toàn bộ nội dung học thuật mục B của ba chương giáo trình trong `docs/`. `concepts.json` chỉ là anchors cho một số khái niệm, không giới hạn phạm vi nguồn. Kết quả nối lời bàn luận thật với đoạn sách, kèm trích dẫn và vị trí trang/dòng; không ghép chỉ vì trùng từ khóa.

Chỉ mục tự cập nhật trước `dev` và `build`. Sau khi sửa giáo trình, có thể sinh và kiểm tra riêng:

```bash
npm run index:mln111
npm run check:xray-content
npm run lint
npx tsc --noEmit
npm run build
```

Đánh giá ý nghĩa bằng model thật dùng key trong `.env` và có API billing:

```bash
npm run eval:xray -- --all
npm run check:xray-evidence
```

Lệnh đầu lưu checkpoint vào `content/mln111/xray-live-evaluation.json`. Có thể dùng `--all --resume` nếu mã/nguồn/corpus không đổi; `--case <id>` chạy một ca. Lệnh kiểm tra bằng chứng không gọi API, yêu cầu đủ corpus và fingerprint còn khớp. Kết quả test cục bộ hay một smoke case không thay thế đánh giá toàn bộ bằng model thật.

Hợp đồng, phạm vi, các trạng thái rỗng/lỗi, cấu trúc thành phần và giới hạn kiểm chứng: [docs/xray.md](docs/xray.md). Chất lượng học thuật của liên hệ vẫn cần đọc và đối chiếu; hợp lệ về ID/trích dẫn không tự chứng minh giải thích đúng.

Kết quả đợt rà soát và sửa ngày 02/10/2026: [docs/xray-review.md](docs/xray-review.md).
