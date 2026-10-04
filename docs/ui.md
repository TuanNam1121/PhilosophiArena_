# LĂNG KÍNH — AI Philosophy Lab

### Phương án trình bày hoàn chỉnh

---

# 1. Định vị sản phẩm

LĂNG KÍNH không nên được thiết kế như:

- một chatbot nhiều avatar;
- một group chat giữa các triết gia;
- một visual novel thuần đọc chữ;
- một game có điểm số, level, combat hay inventory.

Hình thức phù hợp nhất là:

> **Interactive 2D Philosophical Dialogue Experience**

Có thể mô tả ngắn:

> Một trải nghiệm web 2D trong đó người dùng bước vào những “không gian triết học” khác nhau, quan sát các triết gia trình bày và phản biện, trực tiếp tham gia khi cần, sau đó bóc tách kiến thức MLN111 từ chính cuộc đối thoại.

Ba yếu tố chính:

**Scene-based presentation**  
→ mỗi mode là một không gian riêng.

**Character-focused dialogue**  
→ ai đang nói thì người đó trở thành trọng tâm.

**Light interaction**  
→ chỉ tương tác khi nó thực sự phục vụ cuộc đối thoại.

---

# 2. Nguyên tắc thiết kế quan trọng nhất

Không trình bày cuộc hội thoại dưới dạng:

```text
Socrates:
...

Marx:
...

Lenin:
...

You:
...
```

theo chiều dọc giống ChatGPT.

Thay vào đó:

> **mỗi thời điểm chỉ có một ý chính được đưa vào spotlight.**

Người dùng không “đọc log”.

Người dùng đang:

> **chứng kiến một cuộc đối thoại diễn ra.**

Đây là khác biệt căn bản.

---

# 3. Cấu trúc toàn bộ sản phẩm

Sản phẩm có thể gồm sáu không gian chính:

```text
                   LĂNG KÍNH

                       │
                       ▼
                  MAIN HALL
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       ARENA          COURT       SOCRATIC
          │            │            │
          └────────────┼────────────┘
                       ▼
                    X-RAY
                       ▼
                 CONCEPT MAP
                       ▼
                  YOUR LENS
```

Không cần người dùng điều khiển nhân vật đi giữa các phòng.

Main Hall chỉ là một màn hình lựa chọn trực quan.

---

# 4. MAIN HALL

Đây là màn hình mở đầu.

Không nên có dashboard phức tạp.

Chỉ cần:

# LĂNG KÍNH

### Bạn đang băn khoăn điều gì?

Một ô nhập lớn.

Ví dụ:

> AI có khiến con người ngày càng lười suy nghĩ không?

Sau khi nhập, ba “cánh cửa” xuất hiện.

---

## ARENA

Icon hoặc artwork:

> bàn tròn sáu người.

Text:

> **Nhiều lăng kính. Một vấn đề.**

Description:

> Đưa vấn đề trước hội đồng các triết gia và xem nó được nhìn từ nhiều hướng.

---

## COURT

Artwork:

> hai phía đối diện nhau.

Text:

> **Một mệnh đề. Hai phía.**

Description:

> Kiểm tra một lập luận bằng tranh biện và phản biện.

---

## SOCRATIC

Artwork:

> hai ghế đối diện.

Text:

> **Một câu hỏi. Chính bạn.**

Description:

> Để Socrates kiểm tra những định nghĩa và giả định trong chính suy nghĩ của bạn.

---

Có thể có:

> **Recommended**

nhưng không tự động ép mode.

---

# 5. Ngôn ngữ hình ảnh chung

Cả ba mode phải nhìn như cùng một sản phẩm.

Không nên Arena giống game A, Court giống game B và Socratic giống app C.

Nên thống nhất:

- typography;
- portrait style;
- dialogue panel;
- animation timing;
- border;
- iconography;
- background art style;
- cách highlight;
- cách chuyển scene.

Khác biệt chủ yếu nằm ở:

> **composition.**

Arena = tròn.

Court = đối xứng hai phía.

Socratic = đối diện một-một.

---

# 6. Nhân vật nên trình bày như thế nào?

Không cần full-body animation.

Phương án hiệu quả nhất:

> **2D bust portrait — từ ngực trở lên.**

Mỗi nhân vật khoảng 4 trạng thái là đủ:

### Neutral

Trạng thái mặc định.

### Thinking

Khi cân nhắc / phân tích.

### Assertive

Khi đưa argument hoặc challenge.

### Reacting

Khi bị phản bác hoặc nhận ra điểm mới.

Có thể thêm một expression thứ năm nếu thực sự cần.

Không cần lip-sync.

Không cần animation khung xương.

Một số hiệu ứng nhỏ đã đủ:

- scale nhẹ;
- fade;
- chuyển expression;
- slide;
- glow;
- camera crop.

---

# 7. Dialogue Box

Tất cả mode nên dùng cùng một hệ thống dialogue.

Ví dụ:

```text
┌────────────────────────────────────────┐
│ MARX                                   │
│                                        │
│ “Nếu chỉ nhìn vào lựa chọn cá nhân,   │
│ ta có thể bỏ qua những điều kiện xã    │
│ hội đang định hình lựa chọn đó.”       │
│                                        │
│                                  ▶     │
└────────────────────────────────────────┘
```

Tên nhân vật nằm rõ phía trên.

Không dùng chat bubble kiểu Messenger.

Không để từng message chồng dọc.

Dialogue box luôn nằm ở một khu vực cố định.

---

# 8. Một turn không nên quá dài

Vì màn hình visual-novel rất dễ trở thành “wall of text”.

Một lượt của persona nên thường khoảng:

> **2–5 câu ngắn.**

Nếu argument dài, chia thành:

```text
PAGE 1
claim

↓

PAGE 2
reason

↓

PAGE 3
implication
```

nhưng không chia quá nhỏ.

Mục tiêu là:

> mỗi màn hình = một đơn vị tư duy dễ đọc.

---

# 9. Text phải có hierarchy bên trong

Không chỉ là paragraph.

Ví dụ:

> “Nếu chỉ nhìn **lựa chọn cá nhân**, ta có thể bỏ qua những **điều kiện xã hội** đang định hình lựa chọn đó.”

Có thể highlight nhẹ các cụm trọng tâm.

Không highlight thuật ngữ MLN111 ngay từ đầu.

Chỉ highlight phần ý nghĩa của argument.

MLN111 để X-Ray xử lý.

---

# 10. PHILOSOPHY ARENA — bố cục chính

Arena nên là một **council chamber**.

Bố cục cố định:

```text
                   HEGEL
                  [portrait]


       FEUERBACH            MARX
        [portrait]        [portrait]


                 ◇
             ROUND TABLE


       SOCRATES             LENIN
        [portrait]        [portrait]


                  ENGELS
                 [portrait]
```

Cả sáu luôn nhìn thấy.

Đây là điểm rất quan trọng vì concept Arena là:

> **sáu nhà tư tưởng đang cùng hiện diện trong một không gian.**

---

# 11. Active và Observer trong Arena

Không cần viết chữ “Active” trên đầu nhân vật.

Dùng visual state.

### Active speaker

- sáng rõ;
- contrast cao;
- portrait lớn hơn một chút;
- có subtle glow hoặc spotlight.

### Active nhưng chưa nói

- rõ hơn observer;
- có indicator nhỏ.

### Observer

- saturation thấp hơn;
- opacity thấp nhẹ;
- vẫn hoàn toàn nhìn thấy.

Như vậy người dùng hiểu trực giác:

> ai đang tham gia.

---

# 12. Khi một người bắt đầu nói

Không cần thay cả scene.

Camera/focus có thể chuyển nhẹ về phía persona đó.

Ví dụ:

```text
ARENA WIDE SHOT
       ↓
MARX FOCUS
       ↓
Dialogue Box
```

Background vẫn giữ Arena.

Các nhân vật khác vẫn thấy nhưng ít nổi bật hơn.

Điều này tạo cảm giác hội thoại đang diễn ra trong cùng một phòng.

---

# 13. Opening Perspectives

Khi bắt đầu Arena:

```text
PHILOSOPHY ARENA

QUESTION ON THE TABLE

“AI có khiến con người
ngày càng lười suy nghĩ không?”
```

Sau đó:

```text
OPENING PERSPECTIVES
```

Mỗi thinker active lần lượt nêu một opening ngắn; nhóm active thường có 2–4 người, còn Full Council có thể gồm cả sáu.

Sau đó họ dựa vào luận điểm cụ thể của nhau để trả lời hoặc phản biện.

Nếu một thinker hỏi trực tiếp một người khác, spotlight chuyển sang người được hỏi để họ trả lời trước lượt mở ý mới.

Không cần panel cùng lúc hiển thị nhiều essay.

---

# 14. Argument Cards

Đây là một thành phần tôi rất khuyến nghị.

Sau khi một persona hoàn thành một ý quan trọng, hệ thống rút ra một câu ngắn.

Ví dụ:

### SOCRATES

> **QUESTION**  
> “Lười suy nghĩ” thực sự nghĩa là gì?

### MARX

> **CLAIM**  
> Cách sử dụng AI bị định hình một phần bởi môi trường xã hội.

### LENIN

> **TEST**  
> Tác động phải được kiểm tra qua năng lực thực tế.

Các card này nằm ở một panel nhỏ bên cạnh hoặc có thể mở ra.

Không chiếm màn hình chính.

---

# 15. Argument Cards không phải summary ngẫu nhiên

Nên phân loại:

**QUESTION**  
khi persona đặt vấn đề.

**CLAIM**  
khi đưa thesis.

**CHALLENGE**  
khi phản biện.

**DISTINCTION**  
khi phân biệt hai khái niệm.

**TEST**  
khi đề xuất cách kiểm nghiệm.

Nhờ vậy người dùng nhanh chóng hiểu cấu trúc reasoning.

---

# 16. Khi hai triết gia tương tác trực tiếp

Đây là lúc presentation kiểu Ace Attorney phát huy tốt nhất.

Chuyển sang:

# SPLIT VIEW

```text
┌────────────────────┬────────────────────┐
│                    │                    │
│     SOCRATES       │       MARX         │
│                    │                    │
│     portrait       │     portrait       │
│                    │                    │
└────────────────────┴────────────────────┘
```

Người đang nói được highlight.

---

# 17. Nếu là challenge thật

Transition rất ngắn:

```text
CHALLENGE
```

Sau đó Socrates:

> “Nếu hoàn cảnh có ảnh hưởng lớn như anh nói, trách nhiệm của cá nhân nằm ở đâu?”

Marx đáp.

---

# 18. Nếu hai lens bổ sung nhau

Không dùng `CHALLENGE`.

Dùng:

```text
NỐI CÁC LĂNG KÍNH
```

Nhãn này mô tả Hội đồng đang nối các lập luận bổ sung nhau; trên thẻ lập luận, dùng nhãn ngắn **MỐI LIÊN HỆ**. Trạng thái chờ hiển thị cạnh các nút thao tác với câu chữ theo việc đang diễn ra, còn nhãn ở đầu hộp thoại tiếp tục cho biết loại lượt hiện tại.

Ví dụ:

> Socrates đang làm rõ **ta gọi hiện tượng này là gì**.

> Marx đang hỏi **vì sao hiện tượng đó xuất hiện trong điều kiện xã hội cụ thể**.

Rồi trở về Arena wide shot.

Điều này giúp presentation phản ánh đúng logic thay vì mọi thứ đều mang tính đối đầu.

---

# 19. Các transition nên có vocabulary cố định

Tôi đề xuất khoảng sáu transition:

### NEW LENS

Một persona mới bắt đầu tham gia.

### CHALLENGE

Một argument bị tấn công.

### RESPONSE

Persona trả lời challenge.

### CONNECTION

Hai lens được nối.

### OPTIONAL INVITATION

Lời mời góp ý tùy chọn ở gần cuối; nút tiếp tục vẫn cho phép Hội đồng tự khép lại.

### X-RAY

Chuyển sang phân tích MLN111.

Không cần thêm quá nhiều.

---

# 20. User interaction trong Arena

Không cần nhiều button thường trực.

Màn hình chủ yếu là:

> xem / đọc.

Khi thích hợp mới hiện:

### Ask

### Challenge

### Invite

### Add your view

hoặc một textbox:

> **Bạn muốn nói gì?**

Đây là interaction vừa đủ. Mặc định người dùng là khán giả; Hội đồng vẫn tiếp tục dù họ không nhập gì.

Không cần bắt user “chơi” mỗi turn.

---

# 21. Click trực tiếp vào persona

Có thể nhưng nên rất nhẹ.

Click Marx:

```text
MARX

Ask Marx
Challenge Marx
Ask Marx to respond to...
```

Click observer:

```text
HEGEL

Invite Hegel
```

Đây là interaction hữu ích vì nó làm người dùng cảm thấy đang tương tác với **nhân vật trong phòng**, không phải menu chatbot.

---

# 22. Khi persona mới tham gia Arena

Ví dụ Hegel đang observer.

Cuộc thảo luận xuất hiện vấn đề mới.

Transition:

```text
A NEW LENS ENTERS
```

Hegel sáng lên.

Dialogue:

> “Có một điểm mà cuộc tranh luận vừa rồi chưa xét đến…”

Không cần animation bước vào phòng.

Chỉ cần visual state chuyển observer → active.

---

# 23. Lời mời tham gia tùy chọn trong Arena

Chỉ khi các lăng kính chính đã được trao đổi, challenge đang chờ đã được trả lời và cuộc thảo luận gần khép lại, Hội đồng mới đặt một câu hỏi mở thật sự hữu ích cho người dùng. Chỉ mời một lần và không đợi câu trả lời để tiếp tục.

```text
OPTIONAL · YOUR VIEW
```

Không làm tối các persona hoặc nhấn mạnh ghế người dùng như thể họ buộc phải phát biểu. Chỉ nhấn nhẹ ô góp ý và ghi rõ rằng người dùng có thể bỏ qua.

Có thể kèm 3 suggestion rất nhẹ:

> Ask someone

> Challenge a claim

> Add your view

Người dùng vẫn có thể gõ tự do. Nút chính tiếp tục mang nghĩa “Tiếp tục cùng Hội đồng”; khi bị bỏ qua, Hội đồng tự khép lại mà không hỏi lại. Sau phần tổng kết, người dùng vẫn có thể bấm “Tiếp tục thảo luận” nếu muốn mở thêm một hướng.

---

# 24. PHILOSOPHY COURT — presentation

Court phải nhìn khác Arena ngay lập tức.

Composition:

```text
              PHILOSOPHY COURT


      SIDE A                   SIDE B

      HEGEL                     MARX
      ENGELS                    LENIN


              SOCRATES
              EXAMINER


                 YOU
                 JURY
```

Trục giữa rất rõ.

Hai phía đối xứng.

---

# 25. Motion là trung tâm thị giác của Court

Ngay đầu session:

```text
CASE #018

MOTION

“AI có thể được xem
là một chủ thể sáng tạo.”
```

Sau đó motion luôn có thể xem lại ở phía trên.

Người dùng không được quên:

> Court đang kiểm tra claim nào.

---

# 26. Opening Case của Court

Side A focus.

Backdrop bên B tối nhẹ.

Lead Advocate đưa argument.

Sau đó Supporting Voice, nếu có.

Argument card phía A được tạo.

Ví dụ:

```text
SIDE A — CORE CLAIM

Novel output + autonomous transformation
can satisfy relevant criteria of creativity.
```

Sau đó Side B.

---

# 27. Point of Dispute

Sau hai opening:

Socrates xuất hiện giữa màn hình.

Transition:

```text
THE REAL DISPUTE
```

Socrates:

> “Hai bên không thật sự bất đồng về việc AI có thể tạo ra cái mới. Họ bất đồng về việc **sáng tạo có đòi hỏi chủ thể có ý định hay không**.”

Dòng này có thể trở thành:

> **Disputed Criterion**

ở giữa Court.

Từ đó tất cả cross-examination xoay quanh nó.

Đây là cách giúp Court cực kỳ dễ theo dõi.

---

# 28. Cross Examination

Không cần mechanic Ace Attorney.

Presentation là đủ.

Ví dụ:

```text
CROSS-EXAMINATION
A → B
```

Split view.

Một bên hỏi.

Bên kia trả lời.

Nếu argument thay đổi, card của bên đó cũng cập nhật.

Ví dụ:

```text
ORIGINAL CLAIM
Creativity requires consciousness.

↓

REFINED CLAIM
Creativity requires intentional evaluation
of one's own output.
```

Đây là visual rất hay cho mục tiêu học tập.

---

# 29. User trong Court

User không cần tương tác mỗi vòng.

Sau một vài lượt:

```text
JURY QUESTION
```

User được chọn:

> Question Side A

> Question Side B

> Ask Socrates

> Add your own point

Cuối session:

```text
YOUR VERDICT
```

Nhưng nên dùng chữ:

> **Your Position**

hoặc:

> **Jury: You**

để tránh cảm giác user phải tuyên “đúng/sai tuyệt đối”.

---

# 30. Court final screen

Ví dụ:

```text
JURY: YOU

Where do you stand?

[ Lean A ]

[ Lean B ]

[ Undecided ]

[ The motion needs reframing ]
```

Sau đó:

> “Why?”

User nhập lý do.

AI phản ánh reasoning.

---

# 31. SOCRATIC MODE — presentation

Mode này phải tối giản hơn rất nhiều.

Nếu Arena đông và Court căng, Socratic phải có cảm giác:

> yên tĩnh.

Layout:

```text
           SOCRATES

        [large portrait]


“Khi bạn nói tự do,
bạn thực sự muốn nói gì?”


        YOU

[_______________________]
```

Không sidebar nhân vật.

Không argument board phức tạp.

---

# 32. Socratic nên có visual progression rất nhẹ

Ở mép màn hình có thể có một “thought trail”.

Ví dụ:

```text
YOUR THOUGHT

“Freedom = no coercion”

       ↓

“Circumstances can limit choices”

       ↓

“Freedom depends partly
on real possibilities”
```

Không hiện ngay đầy đủ.

Mỗi checkpoint mới thêm một node.

Cuối session user nhìn thấy:

> suy nghĩ của mình đã chuyển dịch.

---

# 33. Socratic không cần button nhiều

Chỉ cần:

- textbox;
- Continue;
- Ask Socrates to clarify;
- End reflection.

Không cần lựa chọn canned response thường xuyên.

Nếu user không biết trả lời, có thể có:

> **Give me an example**

nhưng nên là optional.

---

# 34. Dialogue History

Tất cả ba mode nên có một icon:

> **Transcript**

Khi mở:

```text
Socrates
...

Marx
...

You
...
```

Tức là giao diện chat truyền thống chỉ tồn tại trong **history**, không phải presentation chính.

Điều này rất quan trọng.

Main experience vẫn cinematic.

Nhưng user vẫn có thể xem lại chính xác nội dung.

---

# 35. PHILOSOPHY X-RAY — presentation

Đây nên là một scene riêng, không chỉ một tab.

Khi user chọn X-Ray:

```text
X-RAY ACTIVATED
```

Background của session được giữ nhưng tối đi.

Các argument card hoặc đoạn dialogue quan trọng sáng lên.

Ví dụ:

```text
LENIN

“Muốn biết AI có thực sự làm giảm năng lực,
cần xem người học có thể vận dụng kiến thức
vào một tình huống mới hay không.”

             ↓

        [ X-RAY ]

             ↓

THỰC TIỄN ↔ NHẬN THỨC
```

Đây là cách trực quan hóa:

> dialogue → reasoning → concept.

---

# 36. X-Ray card

Mỗi concept là một card.

Ví dụ:

```text
┌────────────────────────────────┐
│ THỰC TIỄN VÀ NHẬN THỨC        │
│                                │
│ FOUND IN                       │
│ Lenin's argument               │
│                                │
│ WHY                            │
│ Một nhận định được yêu cầu     │
│ kiểm nghiệm trong hoạt động    │
│ thực tế.                       │
│                                │
│ MLN111                         │
│ [Read concept]                 │
│                                │
│ ANOTHER EXAMPLE                │
│ [View]                         │
└────────────────────────────────┘
```

Mặc định hiện tối đa bốn card. Nút “Xem thêm liên hệ” mở các kết quả còn lại; không bỏ kết quả bằng một trần tám card.

### Hợp đồng hiển thị hiện tại

Mỗi kết quả hiển thị một hoặc nhiều trích đoạn bằng chứng, tên đơn vị khái niệm từ nguồn và lý do liên hệ. Server lấy trích đoạn bằng ID span, không hiển thị câu trích do model tự viết. Có thể mở cả lượt thoại hoặc cả đoạn nguồn để kiểm tra ngữ cảnh. Mỗi nguồn có chương/mục, trang theo footer của Markdown và dòng của chunk riêng; nếu dùng nhiều nguồn thì từng nguồn có tham chiếu riêng. Gắn nhãn **LIÊN HỆ THEO ĐOẠN TRÍCH** hoặc **LIÊN HỆ QUA DIỄN GIẢI**; ví dụ minh họa mới tách khỏi đoạn sách.

Các trạng thái rỗng phải được phân biệt:

- **Demo:** đây là bản xem trước, chưa tra giáo trình.
- **Chưa có lời bàn luận:** phiên chỉ có câu hỏi/moderator, chưa có bằng chứng thinker/user để đối chiếu.
- **Chưa có đoạn ứng viên:** chỉ mục chưa truy hồi được đoạn phù hợp; không kết luận sách không có nội dung liên quan.
- **Không đủ căn cứ:** đã có đoạn ứng viên nhưng chưa tìm thấy liên hệ đạt yêu cầu lập luận và nguồn.
- **Bị loại khi kiểm tra:** đề xuất có ID span hoặc ràng buộc nguồn/bằng chứng sai; không hiển thị như match. Bản lặp được báo riêng, không bị gọi là tham chiếu sai.
- **Lỗi dịch vụ:** báo lỗi API riêng và giữ nguyên nội dung phiên.

Concept Map dùng câu hỏi đang được tinh chỉnh gần nhất và ghi số liên hệ đang hiển thị. Nếu một liên hệ dựa vào nhiều lượt, hiện các trích đoạn đó cùng nhau để theo dõi mạch lập luận. Thông báo phạm vi phân biệt việc dò chỉ mục cả ba chương với các chương thực sự có đoạn được chọn; không nói đã lấy đoạn từ cả ba nếu ứng viên chỉ thuộc một hoặc hai chương.

---

# 37. Concept Map

Sau X-Ray có thể chọn:

> **View Map**

Concept Map phải trực quan và nhỏ.

Không cố tạo mạng lưới khổng lồ.

Ví dụ:

```text
        AI USE
          │
          │ affects
          ▼
    LEARNING PRACTICE
          │
          │ evaluated through
          ▼
       PRACTICE
          │
          │ informs
          ▼
      KNOWLEDGE
```

Nếu có concept MLN111 tương ứng, node có label phụ.

Ví dụ:

> **Thực tiễn – Nhận thức**

---

# 38. YOUR LENS

Đây là scene kết thúc.

Không còn tất cả persona nói.

Background có thể trở nên yên hơn.

Title:

# YOUR LENS

Subtext:

> Sau cuộc đối thoại, bạn nhìn vấn đề này như thế nào?

Nếu user đã nói nhiều:

> hệ thống đề xuất một bản tổng hợp.

User chỉnh lại.

Sau đó:

```text
YOUR LENS SAVED
```

Không cần điểm.

Không cần rank.

---

# 39. Before / After

Một presentation rất đáng làm:

```text
WHEN YOU ENTERED

“AI làm con người lười suy nghĩ.”

          ↓

AFTER THE SESSION

“AI không tất yếu làm suy giảm tư duy;
tác động phụ thuộc vào loại kỹ năng,
cách sử dụng và môi trường, và cần được
kiểm tra bằng khả năng vận dụng thực tế.”
```

Đây là “reward screen” tốt hơn XP rất nhiều.

---

# 40. Concept Discovery

Nếu muốn thêm cảm giác achievement nhẹ:

```text
CONCEPT DISCOVERED

THỰC TIỄN ↔ NHẬN THỨC
```

Nhưng không cần:

> +100 XP.

Concept được thêm vào:

> **My Philosophy Map**

Đây là progression phù hợp nhất.

---

# 41. My Philosophy Map / Archive

Đây là phần optional nhưng rất hợp.

Người dùng có thể xem:

```text
MY PHILOSOPHY MAP

● Vật chất – Ý thức
● Thực tiễn – Nhận thức
● Nội dung – Hình thức
● Bản chất – Hiện tượng
...
```

Click vào concept:

> definition;

> những session đã gặp concept đó;

> ví dụ.

Nhờ vậy sản phẩm có giá trị học tập lâu dài.

---

# 42. Philosophy Journal

Nếu nhóm còn thời gian, có thể thêm:

```text
SESSION #12

QUESTION
AI có khiến con người lười?

MODE
Arena

THINKERS
Socrates / Marx / Lenin

DISCOVERED
Thực tiễn – Nhận thức

YOUR LENS
...
```

Đây là history theo hướng học tập, không phải chat log.

---

# 43. Sound

Âm thanh không cần nhiều.

Chỉ cần:

- background ambience nhẹ;
- short transition sound;
- click/confirm;
- X-Ray activation;
- challenge cue.

Không cần music thay đổi liên tục.

Không nên khiến triết học thành melodrama.

---

# 44. Voice / TTS

Nếu có TTS, nên là enhancement.

Không phải bắt buộc.

Người dùng phải có:

> mute / skip / text immediately.

Không bắt user chờ nhân vật nói hết.

Nếu TTS chất lượng không đủ tốt, text + portrait vẫn hoàn toàn ổn.

---

# 45. Animation

Animation nên theo nguyên tắc:

> **ít nhưng có chức năng.**

Dùng animation để:

- chuyển focus;
- báo speaker;
- báo challenge;
- đưa persona vào spotlight;
- mở X-Ray.

Không dùng animation chỉ để trang trí.

---

# 46. Không nên có

Tôi sẽ loại bỏ:

- avatar người dùng chạy quanh map;
- inventory;
- combat;
- point-and-click puzzle;
- currency;
- lives;
- energy;
- XP;
- leaderboard;
- daily reward;
- unnecessary achievements;
- 3D environment;
- branching cinematic story;
- hundreds of character poses.

Tất cả đều làm nhóm tốn công nhưng không làm sản phẩm học tốt hơn.

---

# 47. Một phiên Arena nhìn tổng thể sẽ như thế này

### Screen 1

```text
QUESTION ON THE TABLE

AI có khiến con người
ngày càng lười suy nghĩ không?
```

↓

### Screen 2

Arena wide shot.

6 nhân vật.

Socrates / Marx / Lenin sáng lên.

↓

### Screen 3

```text
OPENING PERSPECTIVES
```

↓

### Screen 4

Socrates focus.

Dialogue.

Argument Card được tạo.

↓

### Screen 5

Marx focus.

Dialogue.

Argument Card.

↓

### Screen 6

Lenin focus.

Dialogue.

↓

### Screen 7

```text
CONNECTION
```

hoặc:

```text
CHALLENGE
```

↓

### Screen 8

Split-screen Socrates ↔ Marx.

↓

### Screen 9

```text
OPTIONAL · YOUR VIEW
```

Người dùng có thể góp ý hoặc bỏ qua để Hội đồng tiếp tục.

↓

### Screen 10 (nếu người dùng tự nguyện góp ý)

Persona phù hợp phản hồi ý người dùng rồi cuộc thảo luận tiếp tục nếu còn điểm đáng bàn.

↓

### Screen 11

```text
WHAT CHANGED?
```

Câu hỏi ban đầu → câu hỏi đã tinh chỉnh.

↓

### Screen 12

```text
X-RAY ACTIVATED
```

↓

### Screen 13

Concept Cards.

↓

### Screen 14

```text
YOUR LENS
```

↓

### Screen 15

Before / After.

Session complete.

---

# 48. Một phiên Court

```text
CASE INTRO

↓

MOTION

↓

Courtroom reveal

↓

Side A opening

↓

Side B opening

↓

THE REAL DISPUTE

↓

Cross Examination

↓

Response

↓

Cross Examination

↓

Response

↓

JURY QUESTION

↓

Closing Positions

↓

JURY: YOU

↓

Why?

↓

Optional Stress Test

↓

X-RAY

↓

YOUR LENS
```

---

# 49. Một phiên Socratic

```text
ENTER THE CHAMBER

↓

Your initial claim

↓

Socrates question

↓

Your answer

↓

Brief reflection

↓

Deeper question

↓

Your answer

↓

Counterexample

↓

Refinement

↓

BEFORE / AFTER

↓

X-RAY

↓

YOUR LENS
```

---

# 50. Phong cách presentation nên học gì từ Ace Attorney?

Nên học:

- một speaker được focus tại một thời điểm;
- character expression;
- split-screen confrontation;
- dramatic but short transition;
- clear phase changes;
- dialogue có nhịp;
- mỗi claim quan trọng được visually emphasized.

Không nên copy:

- objection graphic;
- courtroom asset;
- exact UI;
- sound;
- typography;
- pose;
- màu;
- logo.

LĂNG KÍNH phải có visual identity riêng.

---

# 51. Phong cách nên học gì từ Visual Novel?

Nên lấy:

- portrait;
- dialogue box;
- background scene;
- expression switching;
- click-to-progress;
- transcript;
- smooth scene transition.

Không nên lấy:

- tuyến truyện cố định;
- route;
- ending;
- quá nhiều choices;
- text dài hàng trang.

---

# 52. Visual identity riêng của LĂNG KÍNH

Tên “LĂNG KÍNH” rất mạnh.

Nên lấy:

> **light / lens / refraction / focus**

làm motif.

Ví dụ:

Câu hỏi ban đầu:

```text
           QUESTION
              │
              ▼
              ◇
           /  │  \
          /   │   \
   Socrates  Marx  Lenin
```

Một vấn đề đi qua nhiều lăng kính.

X-Ray:

> ánh sáng xuyên qua một argument để lộ concept.

Concept Map:

> các tia kết nối.

Spotlight:

> người đang nói được focus.

Như vậy presentation không cần giống game nào cụ thể.

---

# 53. Ba mode cần có ba composition khác nhau

Đây là điểm tôi coi là bắt buộc.

### ARENA

**Radial / circular composition**

Thông điệp:

> nhiều góc nhìn cùng tồn tại.

### COURT

**Bilateral / symmetric composition**

Thông điệp:

> hai lập luận đang đối đầu.

### SOCRATIC

**Linear / face-to-face composition**

Thông điệp:

> một người đối diện với chính suy nghĩ của mình.

Chỉ riêng ba geometry này đã giúp user hiểu mode mà không cần đọc giải thích.

---

# 54. Interaction nên giữ ở mức nào?

Tôi khuyên:

> **80% xem/đọc — 20% tương tác.**

Không phải chính xác về số liệu, mà là triết lý.

User không cần click lựa chọn mỗi 20 giây.

Interaction chỉ xuất hiện khi có giá trị:

- chọn mode;
- chọn/ gọi persona;
- challenge;
- hỏi;
- đưa quan điểm;
- Jury;
- X-Ray;
- reflection.

Như vậy trải nghiệm không mệt.

---

# 55. Phương án cuối cùng nên chốt

LĂNG KÍNH nên được thiết kế như:

> **một web trải nghiệm đối thoại triết học 2D theo scene, với nhân vật và cách trình bày lấy cảm hứng từ visual novel và courtroom dialogue.**

Không phải:

> “web game”.

Không phải:

> “chatbot sáu persona”.

Không phải:

> “visual novel thuần túy”.

Cấu trúc presentation:

**Main Hall**

→ lựa chọn cách khám phá.

**Arena**

→ sáu người quanh bàn, spotlight thay đổi.

**Court**

→ hai phía đối diện, Socrates ở trung tâm, user là Jury.

**Socratic**

→ một không gian yên tĩnh, Socrates đối diện trực tiếp user.

**X-Ray**

→ bóc dialogue thành reasoning và khái niệm MLN111.

**Your Lens**

→ trả spotlight về user.

---

# 56. Một câu mô tả sản phẩm nên dùng

> **LĂNG KÍNH là một trải nghiệm web tương tác về Triết học Mác–Lênin, sử dụng không gian 2D và cách trình bày hội thoại lấy cảm hứng từ visual novel và courtroom drama để biến những vấn đề đời sống thành các cuộc đối thoại triết học trực quan. Thay vì đọc một chuỗi chat, người dùng chứng kiến các lăng kính tư tưởng được đặt lên bàn, tương tác khi cần, rồi sử dụng Philosophy X-Ray để nhận ra những khái niệm MLN111 đang vận hành phía sau cuộc tranh luận.**

Đây là cách tôi cho rằng mô tả chính xác nhất sản phẩm hiện tại.
