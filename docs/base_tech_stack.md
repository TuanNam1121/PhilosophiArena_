## Tech stack cuối cùng

| Phần | Công nghệ chốt | Vai trò |
|---|---|---|
| Ngôn ngữ | **TypeScript** | Toàn bộ frontend + backend |
| Framework | **Next.js App Router** | Một project full-stack |
| UI | **React** | Arena / Court / Socratic / X-Ray |
| Styling | **Tailwind CSS** | Toàn bộ scene 2D và responsive layout |
| Animation | **Motion for React** | Spotlight, focus, split-screen, transitions |
| LLM | **GPT-6 Luna (`gpt-6-luna`)** | Dialogue, reasoning, routing, X-Ray |
| OpenAI integration | **Official `openai` npm SDK** | Gọi GPT-6 Luna |
| API | **OpenAI Responses API** | Giao tiếp model |
| Structured output | **OpenAI Structured Outputs + Zod** | Ép output AI đúng schema |
| Flow logic | **TypeScript thuần** | Luật Arena/Court/Socratic |
| State | **React `useReducer` + Context** | Session state trên UI |
| MLN111 knowledge | **JSON + Markdown + chỉ mục BM25 cục bộ** | Tìm đoạn nguồn trên toàn bộ nội dung ba chương; không dùng vector database |
| Persistence MVP | **localStorage** | Session, journal, concepts, settings |
| Concept Map | **HTML/CSS/SVG** | Không cần graph framework ban đầu |
| Database | **Không dùng ở MVP** | Supabase chỉ khi thật sự cần |
| Testing | **Vitest + React Testing Library + Playwright** | Logic + UI + end-to-end |
| Package manager | **pnpm** | Dependencies |
| Code quality | **ESLint + Prettier** | Chuẩn hóa code |
| Repo | **GitHub** | Team collaboration |
| Deployment | **Vercel** | Deploy Next.js |

---

# 1. Thay đổi quan trọng nhất: dùng trực tiếp OpenAI SDK

Stack cũ tôi đề xuất:

```text
Next.js
   ↓
Vercel AI SDK
   ↓
Gemini
```

Sau khi bạn chốt GPT-6 Luna, tôi đổi thành:

```text
Next.js
   ↓
Official OpenAI SDK
   ↓
Responses API
   ↓
GPT-6 Luna
```

Lý do rất đơn giản:

> **Bạn đã biết chắc model/provider là OpenAI, nên không cần thêm một lớp abstraction ở giữa.**

OpenAI cung cấp SDK TypeScript/JavaScript chính thức qua package `openai`, và tài liệu hiện khuyên dùng Responses API cho các ứng dụng text generation mới. :chatgpt-content-reference{index="1"}

Điều này làm stack **đơn giản hơn**, không phức tạp hơn.

---

# 2. GPT-6 Luna có phù hợp với LĂNG KÍNH không?

Có, và thực ra khá hợp với loại workload này.

OpenAI mô tả GPT-6 Luna là model hiệu quả cho các tác vụ tập trung, số lượng lớn. Model hỗ trợ:

- context window **1.05M tokens**;
- maximum output **128K tokens**;
- structured outputs;
- function calling;
- streaming;
- image input;
- reasoning effort từ `none` đến `max`. :chatgpt-content-reference{index="2"}

LĂNG KÍNH chủ yếu có rất nhiều tác vụ tương đối ngắn và lặp lại:

```text
Socrates → 1 turn

Marx → 1 turn

Relation analysis

User response

X-Ray

Reflection
```

Đây đúng là kiểu workload mà Luna nhắm đến.

---

# 3. Không dùng một reasoning level cho tất cả

Đây là thay đổi tôi khuyên thực hiện vì GPT-6 Luna cho phép điều chỉnh reasoning effort. :chatgpt-content-reference{index="3"}

Không cần để:

```text
reasoning = high
```

cho mọi lời thoại.

Sẽ chậm và thừa.

Tôi đề xuất ba mức.

### Dialogue turn

Socrates nói, Marx trả lời, user hỏi...

```text
reasoning.effort = low
```

Hoặc thậm chí `none` nếu qua test thấy chất lượng persona vẫn đủ.

Mục tiêu:

> nhanh và tự nhiên.

---

### Moderator / flow decision

Ví dụ:

> nên chọn nhân vật nào?

> hai argument conflict hay complement?

> next move là challenge hay connection?

Dùng:

```text
reasoning.effort = medium
```

Vì đây là những quyết định ảnh hưởng logic session.

---

### X-Ray / academic mapping

Đây là phần cần cẩn thận nhất.

```text
reasoning.effort = medium
```

hoặc:

```text
high
```

nếu test cho thấy cần.

Bởi vì X-Ray phải tránh những mapping sai kiểu:

> có số → lượng–chất.

Tôi ưu tiên chất lượng hơn latency ở bước này.

---

# 4. Không cần GPT-6 Sol hay Astra cho MVP

GPT-6 family hiện có Astra, Sol và Luna; OpenAI định vị Luna là lựa chọn hiệu quả cho workload tập trung và high-volume. :chatgpt-content-reference{index="4"}

Với LĂNG KÍNH, tôi sẽ không phức tạp thành:

```text
Luna cho dialogue
Sol cho X-Ray
Astra cho moderator
```

Mặc dù về kỹ thuật có thể làm.

Nó tạo ra:

- nhiều pricing;
- nhiều behaviour;
- nhiều testing;
- khó đảm bảo consistency.

### Chốt:

> **GPT-6 Luna cho toàn bộ project.**

Chỉ thay đổi `reasoning.effort` theo nhiệm vụ.

---

# 5. Structured Outputs trở nên rất quan trọng

GPT-6 Luna hỗ trợ Structured Outputs. :chatgpt-content-reference{index="5"}

OpenAI cũng hỗ trợ định nghĩa schema trực tiếp bằng Zod trong JavaScript SDK. :chatgpt-content-reference{index="6"}

Do đó kiến trúc nên là:

```text
GPT-6 Luna
     ↓
Structured Output
     ↓
Zod schema
     ↓
TypeScript object
     ↓
React UI
```

Thay vì:

```text
GPT trả một paragraph
↓
frontend cố đoán đây là challenge hay connection
```

---

# 6. Ví dụ một Turn object

AI không chỉ trả:

> “Nếu môi trường ảnh hưởng…”

Mà trả logic dạng:

```text
type
speaker
target
dialogue
argumentCard
```

Ví dụ:

```text
action = "challenge"

speaker = "socrates"

target = "marx"

dialogue =
"Nếu môi trường có ảnh hưởng mạnh..."

argumentCard =
"Ảnh hưởng cấu trúc có làm giảm trách nhiệm cá nhân?"
```

Frontend thấy:

```text
action = challenge
```

thì tự biết:

> hiển thị split-screen.

AI không điều khiển UI.

---

# 7. Arena output schema

Arena có thể chuẩn hóa các action:

```text
frame
opening
challenge
response
connection
clarify
invite
reflection
```

Ví dụ:

```text
speaker
target
action
dialogue
cardType
cardText
```

Frontend chỉ render.

---

# 8. Court output schema

Có thể chứa:

```text
speaker
side
action

opening_case
cross_examination
response
examiner_question
closing

dialogue
argument_summary
```

Frontend thấy:

```text
side = A
```

→ focus bên trái.

---

# 9. Socratic output schema

Rất đơn giản:

```text
move:
  definition
  assumption
  counterexample
  consequence
  reflection
  refinement

dialogue

currentUserPosition
```

Frontend không cần suy đoán Socrates vừa làm gì.

---

# 10. X-Ray schema nên nghiêm nhất

Ví dụ:

```text
conceptId
sourceSpanIds
evidenceSpanIds
reasoningPattern
mapRelation
whyItMatches
supportType
everydayExample
```

Nếu không có liên hệ đủ mạnh:

```text
matches = []
```

Điểm này quan trọng.

Model phải được phép nói:

> “Không có concept MLN111 đủ mạnh để map đoạn này.”

---

# 11. OpenAI Structured Outputs giúp giảm validation thủ công

Structured Outputs được thiết kế để output tuân theo JSON Schema đã cung cấp, và OpenAI SDK hỗ trợ object schema dựa trên `z.object`. :chatgpt-content-reference{index="7"}

Như vậy Zod có hai vai trò:

```text
1. Định nghĩa schema cho AI.

2. Type-safe object trong app.
```

Không cần viết:

```text
JSON.parse()
if (...)
retry...
```

cho phần lớn trường hợp thông thường.

Vẫn cần xử lý refusal/incomplete response, nhưng infrastructure nhỏ hơn rất nhiều.

---

# 12. Responses API thay cho Chat Completions

Tôi chốt:

> **Responses API**

không dùng Chat Completions cho project mới.

OpenAI hiện khuyến nghị Responses API cho các ứng dụng text mới và reasoning models. :chatgpt-content-reference{index="8"}

Luồng:

```text
Next.js Route Handler
        ↓
OpenAI SDK
        ↓
client.responses.create(...)
        ↓
gpt-6-luna
```

---

# 13. Không cần Agents SDK

GPT-6 hỗ trợ nhiều tính năng agentic mạnh, nhưng LĂNG KÍNH không cần chúng.

Không dùng:

> OpenAI Agents SDK.

Không cần:

> agent handoffs.

Không cần:

> autonomous tool planning.

Không cần:

> six philosopher agents.

OpenAI có Agents SDK riêng cho hệ thống agent, nhưng đây chính xác là abstraction mà dự án hiện tại không cần. :chatgpt-content-reference{index="9"}

---

# 14. Sáu persona vẫn chỉ là prompt

Architecture vẫn giữ:

```text
GPT-6 Luna
     │
     ├── Socrates prompt
     ├── Hegel prompt
     ├── Feuerbach prompt
     ├── Marx prompt
     ├── Engels prompt
     └── Lenin prompt
```

Không tạo:

```text
6 API clients
6 agents
6 threads
6 autonomous processes
```

Một model là đủ.

---

# 15. Prompt structure được điều chỉnh cho Responses API

OpenAI Responses API cho phép tách high-level `instructions` khỏi user/runtime `input`. :chatgpt-content-reference{index="10"}

Đây rất hợp với LĂNG KÍNH.

Tôi sẽ chia:

### `instructions`

Phần tương đối ổn định:

```text
Base rules
+
Mode rules
+
Persona
+
Output requirements
```

### `input`

Phần dynamic:

```text
Current question
Current phase
Recent turns
Current argument states
User's latest input
Specific task
```

Cấu trúc rõ hơn việc ghép tất cả thành một prompt khổng lồ.

---

# 16. Knowledge MLN111 không bị ảnh hưởng

Vẫn giữ:

> **JSON + Markdown**

Không vì đổi sang GPT-6 Luna mà cần thêm vector database.

Ví dụ:

```text
/content/mln111/
    concepts.json

    matter-consciousness.md
    practice-cognition.md
    quantity-quality.md
    contradiction.md
    ...
```

Concept library là các khái niệm neo có hướng dẫn ghép; X-Ray còn tra cứu chỉ mục nội dung giáo trình để có thể tìm các mục ngoài danh sách neo.

---

# 17. Tra cứu nhẹ trên toàn bộ giáo trình, không dựng vector infrastructure

GPT-6 Luna có context rất lớn, nhưng **context lớn không có nghĩa phải đổ cả giáo trình vào mọi request**.

Đừng làm:

```text
Every request
+
entire MLN111 textbook
```

Tốn token và làm prompt nhiễu.

Thay vào đó, tạo chỉ mục cục bộ từ phần nội dung học thuật của ba chương. BM25 tìm các đoạn ứng viên trong toàn bộ chỉ mục; chỉ mục không rời khỏi server.

### Dialogue

Không cần concept library đầy đủ.

### X-Ray

Đầu tiên, model chọn đơn vị nguồn theo ý nghĩa từ danh mục toàn giáo trình. BM25 xét từng lượt riêng và lấy đoạn trong các đơn vị được chọn; hợp nhất ứng viên rồi xử lý theo batch tối đa 24 chunk. Mỗi batch chỉ kèm lượt liên quan và lân cận, giữ ID gốc. Không đưa toàn văn sách vào request hoặc bỏ lượt đầu chỉ vì các lượt sau chiếm ưu thế.

Model chọn sourceSpanIds/evidenceSpanIds từ các span có sẵn. API tự lấy nguyên văn và vị trí dòng/trang của từng chunk, kiểm tra mọi bằng chứng và ràng buộc concept tới đơn vị nguồn cụ thể. Concept ngoài anchors dùng null và tên từ nguồn. Không có trần tám match âm thầm bỏ liên hệ; khi model không hoàn tất output, API báo lỗi và giữ phiên.

Tự cài bước tìm kiếm BM25 gọn trong ứng dụng; không thêm framework RAG, embeddings, vector database hay dịch vụ tìm kiếm ngoài. Cách này đủ nhẹ cho quy mô giáo trình và dự án môn học này.

---

# 18. Conversation context cũng không nên tận dụng 1.05M một cách vô tội vạ

GPT-6 Luna có context window rất lớn. :chatgpt-content-reference{index="11"}

Nhưng đừng nghĩ:

> “Vậy gửi nguyên toàn bộ session mãi mãi.”

Nên giữ:

```text
Original question

Current phase

Current active positions

Recent relevant turns

Compact session summary
```

Đây là cách rút gọn cho lượt hội thoại thông thường. X-Ray gửi toàn bộ transcript hiện có tới server (tối đa 500 lượt); bước chọn đơn vị nguồn đọc toàn phiên, các batch sau dùng lượt liên quan/lân cận với ID gốc. Vượt giới hạn thì API báo rõ, không âm thầm cắt lượt.

Nếu session dài:

> summary các turn cũ.

Việc này:

- giảm chi phí;
- giảm latency;
- làm model tập trung hơn.

---

# 19. Prompt caching có lợi

GPT-6 Luna hiện có cached-input pricing thấp hơn input thông thường. :chatgpt-content-reference{index="12"}

Do các phần như:

```text
Base Prompt
Persona Prompt
Mode Rules
```

lặp lại rất nhiều giữa các request, cấu trúc prompt ổn định sẽ có lợi cho caching.

Bạn không cần xây một “cache system” phức tạp.

Chỉ cần tránh thay đổi những phần tĩnh một cách vô nghĩa.

---

# 20. Chi phí GPT-6 Luna là lý do model này khá phù hợp

Trang model hiện ghi mức giá tiêu chuẩn:

> $0.10 / 1M input tokens  
> $0.50 / 1M output tokens

và cached input $0.01 / 1M token. :chatgpt-content-reference{index="13"}

Điều này đặc biệt phù hợp với LĂNG KÍNH vì một session có thể cần nhiều LLM calls nhỏ.

Tuy nhiên API page cũng ghi **Free tier không hỗ trợ GPT-6 Luna**, nên nếu dùng API thật thì nhóm cần có API billing. :chatgpt-content-reference{index="14"}

Đây là điểm cần tính trước khi demo.

---

# 21. UI stack không cần thay đổi

Thay Gemini → GPT-6 Luna **không ảnh hưởng frontend**.

Vẫn:

```text
Next.js
React
Tailwind
Motion
```

Bởi UI chỉ nhận structured `Turn`.

Nó không quan tâm model đằng sau là Gemini hay GPT.

Đây cũng chứng minh separation hiện tại hợp lý.

---

# 22. Session logic cũng không cần thay đổi

Các rule:

```text
Arena:
  relation checking
  active speakers
  challenge
  connection

Court:
  sides
  cross examination
  jury

Socratic:
  probe
  reflection
  refinement
```

vẫn viết bằng TypeScript.

Model chỉ thực thi những nhiệm vụ logic đó.

---

# 23. State management giữ nguyên

Vẫn:

> **React `useReducer` + Context**

Không cần Redux/Zustand.

Session:

```text
mode
phase
question
participants
turns
argumentCards
xrayConcepts
userLens
```

đủ.

---

# 24. localStorage vẫn phù hợp

Đổi model không ảnh hưởng persistence.

MVP lưu:

- settings;
- previous sessions;
- concept discoveries;
- journal;
- user lens.

Không login.

---

# 25. Database vẫn chưa cần

Không vì OpenAI có API mà phải thêm database.

Baseline:

> **No database.**

Nếu sau này cần user account/cloud sync:

> **Supabase**.

Nhưng không cài từ ngày đầu.

---

# 26. Concept Map vẫn dùng HTML/CSS/SVG

Không cần React Flow ngay.

X-Ray mỗi session có thể chỉ tạo:

> 2–5 concepts.

Custom SVG là đủ.

---

# 27. Presentation stack hoàn toàn giữ nguyên

Assets:

- WebP / AVIF character portraits;
- WebP backgrounds;
- SVG icons;
- MP3/OGG sounds.

Animation:

> Motion.

Rendering:

> DOM/CSS.

Không game engine.

---

# 28. Streaming: tôi càng không khuyên stream token trực tiếp

GPT-6 Luna hỗ trợ streaming. :chatgpt-content-reference{index="15"}

Nhưng application không phải ChatGPT.

Model có thể hoàn thành structured turn trước.

Sau đó UI thực hiện:

```text
model complete
     ↓
Zod parsed
     ↓
portrait focus
     ↓
dialogue appears
```

Nếu muốn cảm giác Visual Novel:

> dùng typewriter animation phía client.

Đừng để network token stream quyết định animation.

---

# 29. TTS vẫn không phải core

GPT-6 Luna là text reasoning model cho core experience.

TTS tách biệt hoàn toàn.

V1:

> không cần.

Sau này:

```text
dialogue text
   ↓
TTS provider
   ↓
voice
```

Không thay đổi architecture chính.

---

# 30. Updated project structure

Tôi sẽ sửa `/lib/ai.ts` thành OpenAI-specific:

```text
lang-kinh/
│
├── app/
│   ├── page.tsx
│   ├── arena/
│   ├── court/
│   ├── socratic/
│   └── api/
│       └── session/
│           └── turn/
│               └── route.ts
│
├── components/
│   ├── arena/
│   ├── court/
│   ├── socratic/
│   ├── dialogue/
│   ├── characters/
│   ├── xray/
│   └── concept-map/
│
├── logic/
│   ├── arena.ts
│   ├── court.ts
│   ├── socratic.ts
│   ├── session.ts
│   └── xray.ts
│
├── prompts/
│   ├── base.ts
│   ├── personas/
│   ├── modes/
│   ├── xray.ts
│   └── reflection.ts
│
├── schemas/
│   ├── turn.ts
│   ├── arena.ts
│   ├── court.ts
│   ├── socratic.ts
│   └── xray.ts
│
├── content/
│   └── mln111/
│
├── lib/
│   ├── openai.ts
│   ├── storage.ts
│   └── utils.ts
│
├── public/
│   ├── characters/
│   ├── backgrounds/
│   ├── ui/
│   └── audio/
│
└── tests/
```

Rất gọn.

---

# 31. Dependencies core sau thay đổi

Từ stack cũ:

```text
next
react
react-dom
tailwindcss
motion
ai
@ai-sdk/google
zod
```

chuyển thành:

```text
next
react
react-dom

tailwindcss

motion

openai
zod
```

Tức còn **ít dependencies hơn**.

---

# 32. Environment variables

Chỉ cần:

```text
OPENAI_API_KEY
```

Và model config:

```text
AI_MODEL=gpt-6-luna
```

Không hard-code model ở 20 nơi.

---

# 33. Reasoning config nên tập trung một chỗ

Ví dụ về mặt cấu trúc:

```text
dialogue → low

moderation → medium

participant_selection → medium

relation_analysis → medium

xray → medium

reflection → medium
```

X-Ray hiện dùng `medium` trong service đối chiếu; chỉ đổi khi đánh giá live cho thấy cần. Các mức khác trong sơ đồ này là hướng dẫn thiết kế, không phải bằng chứng rằng mọi mode đã được triển khai.

Đây là lợi thế đáng tận dụng của GPT-6 Luna vì model hỗ trợ đầy đủ các mức reasoning từ `none` đến `max`. :chatgpt-content-reference{index="16"}

---

# 34. Một LLM call hoàn chỉnh về mặt logic

Ví dụ Marx bị user challenge:

```text
Session Logic
│
├── mode = Arena
├── phase = discussion
├── speaker = Marx
└── action = respond_to_user

          ↓

Prompt Builder
│
├── Base instructions
├── Marx persona
├── Arena rules
├── Current Marx position
├── relevant previous turns
└── user challenge

          ↓

OpenAI Responses API

model:
gpt-6-luna

reasoning:
low

structured output:
TurnSchema

          ↓

Zod parsed Turn

          ↓

React UI

Marx focus
+
Dialogue box
+
Argument card update
```

Đó là flow chính.

---

# 35. X-Ray flow

```text
Session Transcript
+
Toàn bộ transcript → chọn đơn vị nguồn theo ý nghĩa
+
BM25 theo lượt và đơn vị nguồn → hợp nhất ứng viên

Batch tối đa 24 chunk + các lượt liên quan/lân cận

         ↓

GPT-6 Luna

reasoning:
medium

structured output:
XRayResult[]

         ↓

Zod

         ↓

Resolve quote span IDs + validate all evidence/source references

         ↓

X-Ray Scene
```

Không agent, embeddings, vector database hoặc dịch vụ tìm kiếm ngoài.

Bộ hồi quy cục bộ đối chiếu toàn bộ chunk với văn bản gốc và footer trang, kiểm tra tiểu mục, trích dẫn, enum/null concept, transcript dài, các trạng thái rỗng/lỗi và kết quả trùng. Corpus có ca diễn đạt lại và ca âm. npm run eval:xray -- --all gọi model thật qua cùng service production; báo cáo lưu fingerprint nguồn, catalog, corpus, prompt và mã để phát hiện bằng chứng đã cũ. Kết quả của tập mẫu không phải bảo đảm cho mọi cuộc thoại tương lai. Xem docs/xray.md.

---

# 36. Stack những thứ **không dùng**

Sau thay đổi GPT-6 Luna, danh sách này còn chắc chắn hơn:

**Không dùng:**

- Vercel AI SDK;
- Gemini SDK;
- LangChain;
- LangGraph;
- OpenAI Agents SDK;
- CrewAI;
- AutoGen;
- FastAPI;
- Express backend riêng;
- Redux;
- Zustand ở v1;
- Pinecone;
- Chroma;
- FAISS;
- Firebase;
- MongoDB;
- game engine;
- WebSocket;
- microservices.

---

# 37. Tech stack chốt chính thức

## Core application

> **Next.js App Router + TypeScript**

Một application duy nhất, frontend và server routes cùng codebase.

---

## Presentation

> **React + Tailwind CSS + Motion for React**

Dùng cho:

- Arena council;
- Court split layout;
- Socratic chamber;
- portraits;
- dialogue;
- argument cards;
- cinematic transition;
- X-Ray.

---

## AI

> **GPT-6 Luna (`gpt-6-luna`)**

Model duy nhất cho toàn hệ thống. GPT-6 Luna được OpenAI định vị là model hiệu quả cho focused/high-volume workloads và hỗ trợ Responses API, structured outputs và nhiều mức reasoning effort. :chatgpt-content-reference{index="17"}

---

## OpenAI integration

> **Official OpenAI JavaScript/TypeScript SDK (`openai`)**

+

> **Responses API**

Không dùng abstraction khác. OpenAI hiện khuyến nghị Responses API cho ứng dụng text generation mới. :chatgpt-content-reference{index="18"}

---

## AI schema

> **OpenAI Structured Outputs + Zod**

Structured Outputs hỗ trợ JSON Schema và OpenAI JavaScript SDK hỗ trợ schema từ `z.object`. :chatgpt-content-reference{index="19"}

---

## Application logic

> **Pure TypeScript**

Cho:

- Arena rules;
- Court rules;
- Socratic rules;
- session progression;
- speaker states;
- phase transitions.

---

## React state

> **`useReducer` + Context**

Không Redux.

---

## MLN111 knowledge

> **Giáo trình Markdown + chỉ mục JSON sinh tự động + concept anchors JSON**

Tìm đoạn cục bộ bằng BM25; không embeddings/vector database. `npm run index:mln111` tạo lại chỉ mục; `npm run check:xray-content` xác nhận chỉ mục còn khớp với giáo trình và chạy đánh giá hồi quy truy hồi.

---

## Persistence

> **localStorage**

MVP không có account/database.

---

## Concept Map

> **HTML/CSS/SVG**

React Flow chỉ cân nhắc nếu sau này graph thực sự phức tạp.

---

## Testing

> **Vitest**  
> **React Testing Library**  
> **Playwright**

---

## Development

> **pnpm + ESLint + Prettier + GitHub**

---

## Deployment

> **Vercel**

---

# 38. Kiến trúc cuối cùng

```text
                         USER
                          │
                          ▼
┌──────────────────────────────────────────────┐
│               NEXT.JS + REACT               │
│                                              │
│   ARENA        COURT        SOCRATIC         │
│                                              │
│   Dialogue / Characters / Argument Cards    │
│   X-Ray / Concept Map / Your Lens           │
│                                              │
│        Tailwind CSS + Motion                 │
└─────────────────────┬────────────────────────┘
                      │
               useReducer / Context
                      │
                      ▼
┌──────────────────────────────────────────────┐
│                SESSION LOGIC                 │
│                  TypeScript                  │
│                                              │
│  Arena Rules                                │
│  Court Rules                                │
│  Socratic Rules                             │
│  X-Ray Rules                               │
│                                              │
│  Persona / Phase / Turn management          │
└─────────────────────┬────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────┐
│            NEXT.JS ROUTE HANDLER             │
│                                              │
│ Prompt Builder                              │
│ Concept anchors + BM25 book index           │
│ Retrieved passages + transcript evidence   │
│ Zod Schemas                                 │
└─────────────────────┬────────────────────────┘
                      │
                      ▼
             OFFICIAL OPENAI SDK
                      │
                      ▼
              RESPONSES API
                      │
                      ▼
               GPT-6 LUNA
                      │
                      ▼
           STRUCTURED OUTPUT
                      │
                      ▼
                   ZOD
                      │
                      ▼
               React renders
```

Bên cạnh:

```text
localStorage
│
├── Sessions
├── Journal
├── Concepts discovered
└── Settings
```

---

## Chốt

So với stack trước, việc chuyển sang **GPT-6 Luna thực ra làm kiến trúc gọn hơn**:

```text
TRƯỚC

Vercel AI SDK
+
Google provider
+
Gemini


SAU

Official OpenAI SDK
+
Responses API
+
GPT-6 Luna
```

Tôi sẽ coi đây là **tech stack chính thức cho phiên bản LĂNG KÍNH hiện tại**:

> **Next.js + TypeScript + React + Tailwind CSS + Motion + OpenAI SDK + Responses API + GPT-6 Luna + Zod + JSON/Markdown MLN111 + useReducer/Context + localStorage + Vitest/RTL/Playwright + GitHub/Vercel.**

Nó đủ cho toàn bộ sản phẩm mà chúng ta đã thiết kế, trong khi vẫn giữ đúng mục tiêu ban đầu: **một dự án sinh viên tương đối đơn giản, dễ hiểu, dễ triển khai, nhưng presentation và AI logic đủ mạnh để không trở thành một chatbot thông thường.**
