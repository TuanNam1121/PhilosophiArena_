# Philosophy X-Ray: hợp đồng hiện tại và cách kiểm chứng

Tài liệu này mô tả phần X-Ray **đã được triển khai cho Arena**. `base_idea.md`, `base_tech_stack.md` và `ui.md` còn chứa kế hoạch cho toàn sản phẩm; chúng không chứng minh Court, Socratic, lưu phiên hay các thư viện được đề xuất đã có trong ứng dụng.

## 1. Mục tiêu và phạm vi nguồn

X-Ray nhìn lại lập luận đã xuất hiện, nối **bằng chứng trong cuộc thoại → thao tác tư duy → đoạn giáo trình hỗ trợ**. Nó không tiếp tục đối thoại, không chấm người dùng và không cần người dùng phát biểu mới có kết quả.

Nguồn chuẩn là file giáo trình `780897357-SACH-Giao-trinh…md` trong `docs/`. Bộ sinh yêu cầu đúng một file khớp tên nguồn và lập chỉ mục toàn bộ mục B của cả ba chương. Bìa, lời giới thiệu, mục tiêu, câu hỏi ôn tập và tài liệu tham khảo cuối sách không được dùng để ghép. Chú thích nằm trong mục B vẫn được giữ; chúng không được chuyển thành khái niệm riêng.

`book-index.json` lưu hash nguồn, cấu trúc mục, đơn vị học thuật, chunk và vị trí. Số liệu hiện tại được đọc từ file này hoặc lệnh `npm run index:mln111`; không duy trì bản sao số liệu trong tài liệu.

- Mục Markdown giữ đường dẫn chương/mục và ID ổn định.
- Những tiêu đề học thuật bên trong mục lớn được tách riêng: sáu cặp phạm trù, ba quy luật, các hình thái ý thức xã hội…
- Một đơn vị chỉ có tiêu đề, không có phần giải thích, không được dùng để mapping.
- Chunk tối đa 240 từ phân cách bằng khoảng trắng, chồng lấp 48 từ trong cùng đơn vị. Không cắt theo số ký tự.
- Số trang là marker **cuối trang** trong bản Markdown, áp dụng cho phần văn bản đứng trước marker. Đây là trang in theo bản nguồn, không phải số trang PDF hay màn hình.
- Vị trí được gắn theo từng chunk thực sự trích dẫn, không lấy phạm vi của cả mục lớn. Văn bản được bỏ dấu định dạng Markdown và chuẩn hóa khoảng trắng; không sửa nội dung OCR.
- Bộ sinh và kiểm tra độc lập đối chiếu đủ dòng/từ của phần B, overlap và vị trí trang/dòng. Nếu nguồn thay đổi, phải sinh lại chỉ mục.

`concepts.json` là tập **anchors**: tên, định nghĩa diễn giải, hướng dẫn ghép và selectors nguồn cho một số khái niệm thường gặp. Nó không giới hạn phạm vi giáo trình. Server giải selectors thành `sourceUnitIds`; nguồn không tồn tại khiến bước nạp dữ liệu báo lỗi. Khái niệm ngoài anchors dùng `conceptId=null`, lấy tên từ đơn vị học thuật thật.

## 2. Luồng phân tích

1. UI gửi mọi lượt đã có, giữ ID gốc. API chấp nhận tối đa 500 lượt, tối đa 1.800 ký tự/lượt; ID trùng bị từ chối. X-Ray vượt số lượt trả HTTP 413, không âm thầm cắt phiên.
2. Chỉ `thinker` và `user` làm bằng chứng. Câu hỏi ban đầu và `moderator` chỉ cung cấp ngữ cảnh. Chưa có lượt bằng chứng thì trả `insufficient-dialogue`, không gọi model.
3. Model đọc transcript cùng danh mục **toàn bộ đơn vị nguồn đủ văn bản**, gồm tên, đường dẫn và preview ngắn; chọn đơn vị theo ý nghĩa và lượt liên quan. Đây là chọn ứng viên, chưa xác nhận liên hệ.
4. BM25 xét từng lượt độc lập, bảo vệ ứng viên của những ý ở đầu phiên. Tìm thêm đoạn trong từng đơn vị do bước chọn nguồn đề xuất. Tokenizer giữ các thành phần của “tự do”, “độ”, “ý thức”.
5. Hợp nhất đoạn và lượt liên quan, không áp một top-24 toàn phiên. Chia thành batch tối đa 24 chunk; giữ các chunk của cùng đơn vị cạnh nhau, kèm lượt liên quan và lượt lân cận cho phản biện/hồi đáp. Mỗi batch còn biết danh mục ứng viên toàn phiên để tránh ghép thay bằng mục rộng khi nguồn sát hơn ở batch khác. Hai batch được xử lý đồng thời. Không gửi toàn văn giáo trình.
6. Model đọc các đoạn, chọn ID span nguồn/bằng chứng có sẵn và giải thích quan hệ. Không yêu cầu model tự viết lại câu trích dẫn.
7. Server kiểm tra mọi ID, role, nguồn đã truy hồi và selector anchor; lấy nguyên văn từ span tin cậy rồi gắn nguồn. Một ID bằng chứng sai làm loại **cả đề xuất**, không bỏ ID sai rồi giữ lời giải thích.
8. Chỉ trả kết quả khi các batch đều hoàn tất. Lỗi provider, từ chối hoặc output chưa hoàn chỉnh là lỗi, không giả làm kết quả rỗng hay thành công một phần.

Giới hạn 500 lượt là giới hạn nhận request, không phải cam kết tốc độ cho phiên cực dài. Số đoạn và batch tăng theo độ đa dạng của lập luận. Model dùng `AI_MODEL` (mặc định trong dự án là `gpt-6-luna`), Responses API, Structured Outputs, reasoning `medium`, `store:false`. Mỗi lời gọi có ngân sách output hữu hạn; thiếu output phải thử lại và không được coi là đã rà soát đủ.

## 3. Hợp đồng dữ liệu

Đề xuất từ model:

```json
{
  "conceptId": null,
  "sourceSpanIds": ["p-<chunkId>~<offset>"],
  "evidenceSpanIds": ["e-<turnId>~<offset>"],
  "reasoningPattern": "Phân biệt nội dung và hình thức tổ chức",
  "mapRelation": "được giải thích qua",
  "whyItMatches": "Một chi tiết trong bằng chứng tương ứng với quan hệ được đoạn nguồn nêu; giới hạn diễn giải được nói rõ.",
  "supportType": "interpretive",
  "everydayExample": "Ví dụ minh họa mới, không phải trích từ sách."
}
```

- Mỗi đề xuất chọn 1–4 span nguồn và 1–8 span bằng chứng. Những ID được phép có enum khi kích thước schema phù hợp, và luôn có guard phía server.
- Khái niệm ngoài anchors chỉ dùng một đơn vị nguồn cho một liên hệ. Anchor quan hệ có thể dùng nhiều đơn vị được phép, ví dụ hai chiều quan hệ vật chất–ý thức; từng trích dẫn có vị trí riêng.
- Không có trần tám liên hệ cho toàn bộ phiên. Nếu model không hoàn tất output thì trả lỗi; UI không cắt phần kết quả đã nhận.
- `supportType` là mức trực tiếp/diễn giải do model phân loại, không phải thang độ tin cậy hay chứng nhận đúng học thuật.

Phản hồi API có `type: "xray"`, `analysisState`, `result` và `diagnostics`. Mỗi kết quả thêm `sourceUnitIds`, `sourceTitle`, `evidenceTurnIds`, `evidenceQuotes` và `sourceCitations`. Mỗi citation chứa chunk/unit/title, câu trích nguyên văn, toàn đoạn, file, dòng, trang in và đường dẫn mục. Các trường nguồn chính ở cấp match giữ để UI/type thuận tiện; `sourceCitations` là nơi xem đầy đủ nguồn khi có nhiều đoạn.

`diagnostics` phân biệt tổng phạm vi chỉ mục, các chương thực sự có đoạn ứng viên trong phiên, lượt bằng chứng, số batch/call, đề xuất sai và bản lặp. Số `reviewedEvidenceTurns` biểu thị các lượt được đưa vào bước chọn nguồn, không phải phép chứng minh model đã hiểu đúng từng lượt.

## 4. Trạng thái và giao diện

| Trạng thái | Ý nghĩa |
|---|---|
| `matched` | Có ít nhất một đề xuất qua guard tham chiếu |
| `insufficient-dialogue` | Chưa có lời bàn luận của thinker/user |
| `no-source-candidates` | Chưa chọn được đoạn nguồn |
| `no-supported-match` | Có ứng viên nhưng model chưa tìm được liên hệ đủ căn cứ |
| `invalid-proposals` | Không có kết quả được giữ và có đề xuất/tham chiếu bị loại |
| HTTP 502 | Phân tích chưa hoàn tất; giữ phiên để thử lại |
| Demo preview | Chưa phân tích; không dựng kết quả giả |

Kết quả rỗng **không chứng minh** giáo trình không có nội dung liên quan. `matched` cũng không chứng minh mọi giải thích đúng; guard xác minh tham chiếu và trích dẫn, còn quan hệ học thuật cần đối chứng.

UI hiện bốn card đầu, có “Xem thêm” cho mọi card còn lại. Mỗi card cho đọc đoạn bằng chứng và cả lượt thoại, các câu nguồn và cả chunk, nguồn trang/dòng, giải thích và ví dụ mới. Bản lặp được đếm riêng với đề xuất sai. Concept Map dùng các liên hệ đang hiển thị và ghi rõ số đang hiển thị/tổng số; không tạo cạnh cho toàn giáo trình.

## 5. Kiểm chứng

### Offline: không dùng API billing

```bash
npm run check:xray-content
npm run lint
npx tsc --noEmit
npm run build
```

`check:xray-content` yêu cầu chỉ mục khớp byte với kết quả sinh lại, rồi chạy test Node. Test kiểm tra:

- toàn bộ chunk khớp văn bản, token, dòng và marker trang thật, không cắt 1.500 ký tự;
- từng đơn vị học thuật đủ văn bản tự truy hồi được đoạn của chính nó;
- các tiểu mục cùng parent không bị gộp thành một khái niệm;
- ứng viên đầu phiên còn được giữ sau 80 lượt và trong hợp nhất batch;
- enum/null concept, nguồn ngoài anchors, mọi span trích dẫn, ID sai, moderator không làm evidence;
- trạng thái rỗng khác lỗi, duplicate khác invalid, lỗi batch sau không trả thành công một phần, hơn tám liên hệ được hỗ trợ.

Hai đề xuất dùng cùng đơn vị nguồn và cùng các lượt bằng chứng được coi là bản lặp, kể cả cách diễn đạt `reasoningPattern` khác nhau. Những khái niệm ở các đơn vị nguồn khác nhau vẫn được giữ riêng.

Các test này xác minh mã và dữ liệu, **không thay thế** việc đánh giá ý nghĩa lời giải thích do model thật tạo.

### Live: gọi model thật, có API billing

```bash
# Một ca
npm run eval:xray -- --case chapter-2-matter-consciousness --output content/mln111/xray-live-smoke.json

# Toàn bộ bộ đối chứng
npm run eval:xray -- --all

# Tiếp tục các ca chưa đạt/chưa chạy, chỉ khi fingerprint không thay đổi
npm run eval:xray -- --all --resume

# Cùng đường đi qua API đang chạy
npm run eval:xray -- --case chapter-2-quantity-quality --endpoint http://localhost:3100/api/arena --output content/mln111/xray-http-evaluation.json

# Kiểm tra bằng chứng toàn bộ còn khớp phiên bản hiện tại, không gọi API
npm run check:xray-evidence
```

Corpus `xray-evaluation.json` có nguồn kỳ vọng/nguồn được phép cố định theo tiểu mục; không gửi đáp án oracle cho model. Bao gồm cả ba chương, diễn đạt lại, phối hợp nhiều lượt, khái niệm ngoài anchors, sáu phạm trù/ba quy luật/bảy hình thái trong cùng mục, transcript dài, và ca âm tránh ghép theo từ khóa hoặc nhầm thực tiễn/mâu thuẫn/phủ định/ý thức xã hội.

Với ca âm chỉ gán sai tên khái niệm, X-Ray không được tự viết một phản biện mới rồi gọi đó là thao tác đã xuất hiện trong phiên. Nếu một lượt khác thật sự phản biện/phân biệt, thao tác của lượt ấy có thể là bằng chứng. Định nghĩa ở mục khác cũng có thể là nguồn hỗ trợ hợp lệ khi nó nêu đúng quan hệ; oracle ghi rõ phạm vi được phép và lý do, không chỉ ép một ID mục duy nhất.

Đánh giá live dùng cùng `runMlnXRay` như production. Báo cáo lưu phản hồi thực, model, thời gian, usage và fingerprint nguồn/corpus/catalog/prompt/mã/evaluator. Lưu checkpoint sau mỗi ca. Chỉ `completed=true` với toàn bộ corpus và không ca thất bại mới được tính là bằng chứng hoàn chỉnh. `check:xray-evidence` kiểm tra độ mới và đánh giá lại các nguồn/trích dẫn trong phản hồi đã lưu. Báo cáo smoke không thay thế báo cáo toàn bộ.

Oracle tự động kiểm tra nguồn đúng/đủ và citation literal, nhưng không tự chứng minh toàn bộ `whyItMatches`, ví dụ mới và phân loại direct/interpretive đúng. Cần đọc các kết quả live, chú ý chiều phản biện, quan hệ bị bác bỏ, giới hạn áp dụng và chất lượng học thuật. Đổi nguồn, selectors, thuật toán hoặc prompt thì phải đánh giá lại. Tập đối chứng không bảo đảm mọi cuộc thoại tương lai đều có recall/precision tuyệt đối.

Một số quan hệ có nguồn tương đương ở mục khác: oracle dùng `anyOf` với các lựa chọn được giải thích trong `why`, và có thể yêu cầu `quoteIncludesAll` cho các chi tiết quyết định của câu trích thay thế. Đây không phải cho phép mọi đoạn trong chương. Ca vật chất–ý thức yêu cầu riêng nguồn cho cả hai chiều vì lời thoại thật sự nêu cả hai; nguồn chỉ cho chiều tác động trở lại chưa đủ để ca đó đạt.

Cuối cùng cần kiểm tra HTTP thật (400/413/insufficient/live) và UI thật (nhiều card, mở toàn đoạn, xem thêm, trạng thái rỗng và trở lại phiên), vì test service không chứng minh wiring của route/giao diện.

## 6. Thành phần để bảo trì

| Thành phần | Vai trò |
|---|---|
| `scripts/build_mln111_index.mjs`, `lib/mln111-index.mjs` | Sinh chỉ mục, kiểm tra phạm vi và footer trang |
| `content/mln111/book-index.json` | Dữ liệu nguồn sinh tự động; không sửa tay |
| `concepts.json`, `mln111-concepts.ts`, `mln111-concepts.server.ts` | Anchors nhỏ phía client và selectors nguồn phía server |
| `lib/mln111-book.ts` | Nạp/validate nguồn phía server; không bundle sách xuống client |
| `lib/mln111-search.mjs` | BM25 từng lượt, truy hồi trong đơn vị, hợp nhất và chia batch |
| `lib/mln111-spans.mjs` | Span nguồn/bằng chứng nguyên văn với ID ổn định |
| `lib/mln111-xray-contract.mjs` | Prompt và schema hai bước |
| `lib/mln111-xray.mjs` | Guard nguồn/bằng chứng, citation và duplicate |
| `lib/mln111-xray-service.mjs` | Luồng chung production/live, lỗi provider và diagnostics |
| `app/api/arena/route.ts`, `lib/arena.ts` | Hợp đồng HTTP và types UI |
| `components/arena-workbench.tsx`, `app/globals.css` | Card, trạng thái, hiển thị dần và Concept Map |
| `xray-evaluation.json`, `tests/mln111-xray.test.mjs` | Oracle độc lập và hồi quy offline |
| `scripts/evaluate_mln111_live.mjs`, `mln111-eval-utils.mjs`, `check_mln111_live_evidence.mjs` | Chạy live, lưu bằng chứng và phát hiện báo cáo cũ |

Kiến trúc hiện tại dùng chỉ mục tĩnh và truy hồi cục bộ. Không cần vector database, crawler, nhiều agent tự điều phối hay hệ thống lưu trữ mới để thực hiện luồng này.
