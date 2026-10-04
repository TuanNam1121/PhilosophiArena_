# Rà soát X-Ray ngày 02/10/2026

Đây là bản ghi kết quả kiểm tra X-Ray của Arena tại thời điểm hoàn tất đợt sửa. Hợp đồng và danh sách thành phần bảo trì nằm trong [xray.md](xray.md). Báo cáo live lưu fingerprint để phát hiện mã, nguồn hoặc prompt thay đổi; các kết quả dưới đây là bằng chứng của phiên bản đã kiểm tra.

## 1. Kết quả theo các vấn đề đã phát hiện

| Vấn đề | Cách xử lý hiện tại | Bằng chứng |
|---|---|---|
| Trang nguồn lệch vì số trang được đọc như đầu trang; card dùng phạm vi cả mục | Marker cuối trang áp dụng cho văn bản đứng trước; mỗi chunk có dòng/trang thật | Đối chiếu độc lập toàn bộ 818 chunk với Markdown và footer, fixture trang 12–13 |
| Mục lớn chứa nhiều khái niệm; top-24 và hai đoạn/mục làm rơi ý | Tách đơn vị học thuật, BM25 từng lượt, chọn nguồn theo ý nghĩa trên toàn danh mục, hợp nhất và chia batch | Sáu phạm trù, ba quy luật, bảy hình thái đều có đơn vị riêng; test giữ ứng viên đầu phiên sau 80 lượt; ca live 40 lượt vẫn có ý ở đầu |
| 21 anchors trở thành giới hạn kiến thức; các kết quả ngoài anchors bị gộp | Nguồn chuẩn là chỉ mục sách; `conceptId=null` ngoài anchors, tên và ID theo đơn vị nguồn | Tự truy hồi được từng đơn vị đủ văn bản; live có thế giới quan, tự do–cộng đồng, nội dung–hình thức… |
| Guard chỉ xác minh mục, cho phép sai đoạn/luật, bỏ ID bằng chứng sai rồi giữ lời giải thích | Model chọn ID span; server lấy nguyên văn, kiểm tra mọi nguồn/evidence và ràng buộc anchor tới đơn vị | Test lượng–chất không được trích mâu thuẫn; unknown/mixed unit, ID sai và moderator bị loại cả đề xuất |
| Từ quan trọng bị tokenizer loại | Giữ các từ của tự do, độ, ý thức và bigram | Test thuật ngữ và live tự do–cộng đồng đạt |
| Đánh giá chỉ đo recall mục, chưa chứng minh quyết định của model thật | Oracle theo đơn vị/câu trích, ca âm, transcript dài, service production chung, báo cáo có checkpoint và hash | 23 test cục bộ đạt; 26/26 ca live đạt; `check:xray-evidence` xác nhận còn khớp phiên bản |
| UI/trạng thái/tài liệu gây hiểu nhầm; kết quả bị cắt | Phân biệt thiếu bàn luận, thiếu nguồn, thiếu liên hệ, đề xuất sai và demo; duplicate riêng; bốn card + xem thêm; Map ghi số đang hiện | Kiểm tra browser thật, HTTP thật, đồng bộ README/base idea/tech stack/UI và hợp đồng riêng |

Kiểm tra live còn giúp sửa hai lỗi về cách giải thích: không tự viết một phản biện mới rồi gán cho người nói, và không mô tả hai chiều như đã đối chiếu đủ khi chỉ trích một chiều. Danh mục ứng viên toàn phiên được đưa vào mỗi batch để tránh ghép thay bằng một mục rộng khi nguồn sát hơn nằm ở batch khác.

Các nguồn tương đương ở mục khác được xét dựa trên đoạn sách thật. Oracle có `anyOf` và điều kiện câu trích cho những nguồn thay thế cần chứng minh chi tiết; ca vật chất–ý thức yêu cầu riêng nguồn cho cả hai chiều. Đáp án oracle không được gửi cho model.

## 2. Phạm vi nguồn đã xác nhận

- 119 mục cấu trúc, trong đó 90 mục có văn bản.
- 165 đơn vị nguồn; 164 đơn vị đủ văn bản được dùng để tra cứu.
- 818 chunk lưu trong chỉ mục; 817 chunk tham gia tìm kiếm, một chunk chỉ có tiêu đề được loại khỏi mapping.
- Toàn bộ 1.826 dòng nội dung không rỗng của mục B đã được lập chỉ mục, không có dòng thiếu; 147.623 đơn vị tách bằng khoảng trắng khớp giữa nguồn và chỉ mục.
- Phạm vi gồm mục B của cả ba chương. Bìa, giới thiệu, mục tiêu, câu hỏi ôn tập và tham khảo cuối sách được ghi rõ là phần không làm căn cứ mapping; chú thích trong nội dung được giữ.
- Sách và key nằm phía server; tìm kiếm trong bundle client không thấy chỉ mục sách.

Các số trên là snapshot của lần kiểm tra này; số hiện hành nằm trong `book-index.json` và lệnh sinh chỉ mục.

## 3. Kiểm tra đã chạy

| Kiểm tra | Kết quả |
|---|---|
| `npm run check:xray-content` | Đạt, chỉ mục khớp nguồn và 23/23 test |
| `npm run lint` | Đạt, không lỗi/cảnh báo |
| `npx tsc --noEmit` | Đạt |
| `npm run build` | Đạt với Next.js 16.3.8 |
| `npm run eval:xray -- --all` | 26/26 đạt, gồm 20 ca có căn cứ và 6 ca không nên ghép, model `gpt-6-luna` |
| `npm run check:xray-evidence` | Đạt, `fresh=true`, đủ corpus và fingerprint |
| Gọi X-Ray qua `/api/arena` trên production build local | Ca lượng–chất đạt với nguồn và trích dẫn thật |
| Hợp đồng HTTP | Moderator-only: 200/insufficient, không gọi model; >500 lượt: 413; ID trùng và JSON sai: 400 |
| Browser thật | Trạng thái chưa có bàn luận đúng; phiên thật có sáu card; xem thêm 4/6 → 6/6; mở cả lượt và cả nguồn; trở lại Arena còn nguyên ba lượt transcript |
| Responsive và console | 390 px chuyển một cột, không tràn ngang; dòng nguồn 11 px; trở lại kích thước mặc định; không ghi nhận console error/warning trong phiên QA |

Bằng chứng máy đọc được:

- [xray-live-evaluation.json](../content/mln111/xray-live-evaluation.json): corpus đầy đủ, đề xuất/usage, nguồn/evidence và fingerprints.
- [xray-http-evaluation.json](../content/mln111/xray-http-evaluation.json): ca gọi qua route thật.
- [xray-http-checks.json](../content/mln111/xray-http-checks.json): kết quả các kiểm tra hợp đồng HTTP.
- [xray-bundle-checks.json](../content/mln111/xray-bundle-checks.json): kiểm tra key/chỉ mục không nằm trong các chunk JavaScript client và service chọn nguồn có trong server build.

Đã đọc các giải thích, câu trích và ví dụ trong kết quả live để đối chiếu chiều lập luận, giới hạn diễn giải và nguồn. Test tham chiếu hợp lệ không được dùng riêng để suy ra đúng học thuật.

## 4. Các việc phải giữ khi tiếp tục phát triển

1. Sửa sách: sinh lại chỉ mục và kiểm tra đủ dòng/từ, trang/dòng, selectors anchors.
2. Sửa prompt/truy hồi/guard: chạy lại hồi quy và đánh giá live; giữ các ca âm và ca ngoài anchors.
3. Có ca thực tế bị bỏ sót hoặc ghép sai: lưu một ca tái hiện, xác định nguồn đúng và thao tác thật trong lời thoại, bổ sung oracle trước khi chỉnh mã/prompt.
4. Duy trì phân biệt lời giải thích, trích dẫn nguyên văn, định nghĩa diễn giải của anchor và ví dụ mới.
5. Khi nghiệm thu cho lớp, đọc các phiên mẫu theo chủ đề bài học; báo cáo của một tập mẫu không chứng minh mọi cuộc thoại tương lai đều có precision/recall tuyệt đối.

Trong phạm vi các vấn đề X-Ray đã phát hiện và các kiểm tra trên, không còn mục sửa bắt buộc chưa hoàn tất. Chất lượng nguồn được xác minh theo bản Markdown được cung cấp; chưa đối chiếu bản OCR này với một PDF/bản in khác. Phần X-Ray hiện được triển khai cho Arena; các mode khác trong bản thiết kế vẫn là kế hoạch riêng.
