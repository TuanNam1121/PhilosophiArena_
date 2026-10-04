# Socratic Mode — Plan & Requirements

> Trạng thái: requirement MVP, đã cập nhật theo lựa chọn của người dùng. Ba câu hỏi sản phẩm còn mở ở mục 8.

## 1. Mục tiêu

Tạo một mode đối thoại riêng giữa **người dùng và Socrates**. Socrates giúp người dùng kiểm tra một vấn đề bằng câu hỏi định nghĩa, giả định, phản ví dụ, hệ quả và phân biệt; sau đó phản ánh những gì đã được làm rõ và hỗ trợ tinh chỉnh cách diễn đạt.

Mục tiêu là làm rõ suy nghĩ, không giảng bài, tranh thắng thua, chấm đúng sai hoặc ép người dùng đổi ý. Đây là MVP cho đồ án dùng trong lớp; giữ triển khai gọn, không xây hạ tầng sản phẩm dài hạn.

## 2. Phạm vi MVP

### Bao gồm

- Bắt đầu từ một câu hỏi/vấn đề. Người dùng có thể viết quan điểm ban đầu hoặc chỉ nhập câu hỏi; nếu chưa có quan điểm, Socrates hỏi họ muốn kiểm tra ý nghĩ/giả định nào.
- Chỉ hai vai trò: `user` và `socrates`; không có hội đồng hay phe tranh luận.
- Mỗi lượt Socrates có một thao tác tư duy chính:
  - `definition`: làm rõ nghĩa của từ/khái niệm;
  - `assumption`: hỏi tiền đề đang được giả định;
  - `counterexample`: đưa tình huống thử lập trường;
  - `consequence`: kiểm tra hệ quả;
  - `distinction`: phân biệt hai trường hợp/ý niệm gần nhau;
  - `reflection`: tóm lược trung tính điều người dùng vừa nói;
  - `refinement`: đề xuất cách diễn đạt chính xác hơn.
- Lượt tiếp nối dựa trên câu trả lời mới nhất, không chạy một bộ câu hỏi cố định.
- Người dùng phải trả lời câu hỏi hiện tại trước khi Socrates chuyển tiếp. Có thể yêu cầu làm rõ hoặc xin ví dụ cho câu hỏi đang chờ.
- Có checkpoint phản ánh sau một vài lượt; không hỏi dồn liên tục.
- **Thought Trail** ghi nhận phát biểu người dùng và cả reflection/đề xuất của Socrates, có nhãn nguồn riêng.
- Cuối phiên có Before/After và tổng kết điều đã rõ hơn, điều còn bỏ ngỏ. Chỉ nội dung do người dùng nói/xác nhận mới được xem là lập trường của họ.
- Người dùng chủ động kết thúc phiên bất kỳ lúc nào.
- Lưu phiên Socratic gần nhất và Thought Trail để khôi phục sau khi mở lại trang. Phiên mới thay phiên đã lưu.
- Cho phép mở Philosophy X-Ray hiện có từ phiên Socratic (chi tiết luồng truy cập cần chốt).

### Ngoài phạm vi MVP

- Philosophy Court, phe tranh luận, jury/verdict hoặc hội thoại nhóm.
- Thought experiment dạng mini-game (Trolley Problem, Chinese Room).
- Concept Matrix, hồ sơ khái niệm cá nhân, journal hoặc lịch sử nhiều phiên.
- XP/rank, chấm điểm hoặc đánh giá lập luận người dùng.
- Tự tạo mapping MLN111 trong Socratic Mode; đối chiếu học thuật thuộc X-Ray.
- Database, tài khoản, cloud sync hoặc đồng bộ thiết bị.

## 3. Luồng trải nghiệm

1. **Khởi tạo:** Người dùng nhập câu hỏi/vấn đề; ý kiến ban đầu là tùy chọn. Nếu chưa có ý kiến, Socrates hỏi người dùng muốn khảo sát suy nghĩ hoặc giả định nào.
2. **Làm rõ:** Socrates chọn một move phù hợp, thường là definition hoặc assumption. Mỗi lượt có tối đa một câu hỏi chính.
3. **Thử lập trường:** Dựa trên câu trả lời, Socrates có thể nêu phản ví dụ hoặc hỏi hệ quả. Phản ví dụ là tình huống giả định để kiểm tra, không phải bằng chứng rằng người dùng sai.
4. **Phản ánh:** Sau vài lượt, Socrates nêu ngắn gọn điều người dùng đang khẳng định, điều đã sáng tỏ và điểm còn bỏ ngỏ. Người dùng trả lời để xác nhận hoặc sửa.
5. **Tinh chỉnh:** Socrates có thể đề xuất một câu diễn đạt chính xác hơn. Ghi đề xuất vào Thought Trail với nguồn Socrates; chỉ chuyển thành lập trường của người dùng khi họ xác nhận hoặc tự sửa thành câu của mình.
6. **Kết thúc:** Người dùng chọn kết thúc. Tổng kết hiển thị ý ban đầu (nếu có), ý cuối đã được xác nhận (nếu có), các node Thought Trail và điểm còn bỏ ngỏ.
7. **X-Ray:** Người dùng có thể chuyển transcript sang X-Ray. X-Ray phân tích transcript thật, không tiếp tục hội thoại.

## 4. Yêu cầu hành vi

### Socrates

- Tò mò, tôn trọng, ngắn gọn; không biến thành bài giảng.
- Không gán cho người dùng điều họ chưa nói hoặc chưa xác nhận.
- Không trình bày phản ví dụ giả định như dữ kiện có thật.
- Không xem câu trả lời ngắn hay yêu cầu làm rõ là đồng ý.
- Không lặp cùng một câu hỏi nếu chưa có thông tin mới.
- Không chấm đúng/sai, không buộc người dùng chấp nhận refinement.
- Khi người dùng yêu cầu ví dụ/làm rõ, trả lời đúng yêu cầu hiện tại và tiếp tục chờ người dùng trả lời; không tự coi phần giải thích là câu trả lời thay họ.

### Thought Trail

- Mỗi node liên kết tới ID lượt nguồn và phân biệt `user` với `socrates`.
- Ghi loại chuyển dịch: ban đầu, làm rõ, nhận ra giả định, trường hợp đã thử, reflection hoặc refinement.
- Hiển thị cả nội dung Socrates đề xuất, nhưng gắn nhãn rõ là đề xuất/phản ánh.
- Before/After chỉ lấy lập trường ban đầu/cuối do người dùng nói hoặc xác nhận. Nếu chưa có thay đổi được xác nhận, nói rõ điều đó.
- Không cần tạo node cho mọi lượt; chỉ ghi điểm làm rõ/chuyển dịch có ý nghĩa.

### Lưu phiên

- Lưu một phiên gần nhất bằng localStorage để có thể khôi phục sau reload/mở lại trang.
- Bắt đầu phiên mới thay phiên cũ; có thao tác xóa/reset.
- Không gửi API key hoặc bí mật xuống client; dùng route server hiện có.

## 5. Hợp đồng dữ liệu gợi ý

Schema Socratic nên độc lập với hợp đồng Arena để tránh lẫn luật giữa hai mode.

```ts
type SocraticMove =
  | "definition" | "assumption" | "counterexample" | "consequence"
  | "distinction" | "reflection" | "refinement";

type SocraticTurn = {
  id: string;
  role: "user" | "socrates";
  text: string;
  move?: SocraticMove;
  inReplyToTurnId?: string;
};

type ThoughtNode = {
  id: string;
  sourceTurnIds: string[];
  source: "user" | "socrates";
  text: string;
  kind: "initial" | "clarification" | "assumption" | "tested" | "reflection" | "refinement";
  status: "stated" | "confirmed" | "suggestion";
};
```

Một phản hồi Socrates nên chứa move, lời phản ánh tùy chọn, tối đa một câu hỏi chính và refinement tùy chọn. Ứng dụng giữ transcript/ID lượt; không giao cho model tự viết lại toàn bộ Thought Trail. Node Socrates và node user phải được thể hiện là hai nguồn khác nhau.

## 6. Tiêu chí nghiệm thu

- Có thể vào Socratic Mode từ một vấn đề mà không qua Arena; quan điểm ban đầu được phép bỏ trống.
- Khi quan điểm ban đầu trống, Socrates hỏi người dùng muốn khảo sát điều gì trước khi đặt câu hỏi đào sâu.
- Transcript chỉ gồm user/Socrates và request tiếp nối nhận đúng các lượt hiện có.
- Mỗi lượt Socrates có một move chính, tối đa một câu hỏi chính và bám vào câu trả lời gần nhất.
- Người dùng không thể yêu cầu Socrates đi tiếp mà chưa trả lời câu hỏi đang chờ; làm rõ/xin ví dụ vẫn được phép.
- Phản ví dụ là giả định dùng để kiểm tra, không áp đặt kết luận.
- Có checkpoint phản ánh; người dùng có thể xác nhận hoặc sửa nội dung phản ánh.
- Thought Trail lưu cả lời user và nội dung Socrates với nhãn nguồn rõ ràng; Before/After không nhận nhầm đề xuất Socrates thành ý user.
- Người dùng kết thúc phiên chủ động được bất kỳ lúc nào.
- Phiên gần nhất phục hồi sau reload; phiên mới thay phiên trước; reset xóa dữ liệu đã lưu.
- Lỗi API cho phép thử lại mà không mất transcript đã lưu. Hành vi thiếu API key cần nhất quán với cơ chế demo của Arena.
- X-Ray chỉ chạy khi người dùng chủ động chọn và nhận đúng transcript Socratic.

## 7. Kế hoạch triển khai

1. Chốt nhịp checkpoint và cách xác nhận/sửa refinement (mục 8).
2. Tạo type/schema và prompt Socratic độc lập; validate phản hồi AI bằng Zod/Structured Outputs ở server.
3. Bổ sung xử lý API start/continue/clarify/example; giới hạn đầu vào và transcript phù hợp prototype.
4. Bổ sung điều phối phiên: transcript, câu hỏi đang chờ, retry, kết thúc/reset và lưu/khôi phục một phiên bằng localStorage.
5. Thêm điểm vào Socratic Mode và trải nghiệm hội thoại tối giản; không mở rộng thành Archive.
6. Thêm Thought Trail, checkpoint và Before/After với nhãn nguồn tách bạch.
7. Nối X-Ray hiện có theo lựa chọn người dùng.
8. Kiểm tra các tiêu chí nghiệm thu: bắt đầu có/không có ý ban đầu, continue, clarify/example, refinement chưa xác nhận, reload, reset, lỗi API và X-Ray.

## 8. Câu hỏi còn mở

1. **Checkpoint:** sau khoảng bao nhiêu câu trả lời của người dùng thì nên phản ánh? Đề xuất mặc định: 2–3 câu trả lời, nhưng chỉ tạo checkpoint khi có điều đáng tổng kết.
2. **Xác nhận refinement:** nên có nút xác nhận/sửa riêng, hay Socrates chỉ hỏi người dùng tự viết lại quan điểm?
3. **X-Ray:** mở được ngay từ Socratic Mode hay chỉ sau khi người dùng kết thúc phiên?

## 9. Quyết định đã chốt

- Socratic là mode độc lập `USER ↔ SOCRATES`, không phải Arena với một thinker được chọn.
- Người dùng bắt buộc trả lời câu hỏi đang chờ trước khi Socrates đi tiếp; có thể xin làm rõ hoặc ví dụ.
- Người dùng tự quyết định thời điểm kết thúc.
- Lưu một phiên gần nhất qua lần mở lại; phiên mới thay phiên cũ.
- Có thể bắt đầu chỉ bằng câu hỏi hoặc cung cấp quan điểm ban đầu.
- Thought Trail ghi cả ý người dùng và nội dung Socrates, đồng thời gắn nhãn nguồn; lời Socrates không tự trở thành lập trường người dùng.
- Socrates kiểm tra lập trường thay vì giảng bài; không chấm đúng/sai.
- Bộ move gồm definition, assumption, counterexample, consequence, distinction, reflection, refinement.
- X-Ray là bước nhìn lại transcript, không tiếp tục đối thoại.

Các quyết định thiết kế được tổng hợp từ `docs/base_idea.md`, `docs/base_tech_stack.md`, `docs/ui.md`, tài liệu đặc tả tính năng người dùng cung cấp và câu trả lời trong cuộc trò chuyện. Chúng mô tả yêu cầu mục tiêu, không phải bằng chứng tính năng đã được triển khai.
