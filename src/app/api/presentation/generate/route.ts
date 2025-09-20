import { LangChainAdapter } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

// interface SlidesRequest {
//   title: string; // Presentation title
//   outline: string[]; // Array of main topics with markdown content
//   language: string; // Language to use for the slides
//   tone: string; // Style for image queries (optional)
// }
interface SlideData {
  title: string;
  content: string;
}

interface SlidesRequest {
  presentationTitle: string;
  slides: { [key: string]: SlideData };
  language: string;
  tone: string;
}
const slidesTemplate = `
You are an expert presentation designer. Your task is to structure the provided JSON content into a visually engaging presentation in XML format. Your primary role is to choose the best layout and create a relevant image query for the given text, which you must not change.

## CORE REQUIREMENTS
1.  **FORMAT**: Use <SECTION> tags for each slide, as specified in the structure.
2.  **CONTENT**: Use the EXACT 'title' and 'content' from the provided JSON for each slide. **DO NOT** add, remove, paraphrase, or modify the text in any way.
3.  **VARIETY**: Each slide must use a DIFFERENT layout component from the "AVAILABLE LAYOUTS" list. Do not use the same layout twice in a row.
4.  **VISUALS**: For each slide, create a detailed, descriptive image query (10+ words) that is highly relevant to the slide's content.

## PRESENTATION DETAILS
-   Presentation Title: {presentationTitle}
-   Slide Content (JSON): {slidesJson}
-   Language: {language}
-   Image Query Tone: {tone}
-   Total Slides to Generate: {totalSlides}

## PRESENTATION STRUCTURE
\`\`\`xml
<PRESENTATION>

<!--Every slide must follow this structure (layout determines where the image appears) -->
<SECTION layout="left" | "right" | "vertical">
  <!-- Required: include ONE layout component per slide -->
  <!-- Required: include at least one detailed image query -->
</SECTION>

<!-- Other Slides in the SECTION tag-->

</PRESENTATION>
\`\`\`

## SECTION LAYOUTS
Vary the layout attribute in each SECTION tag to control image placement:
- layout="left" - Root image appears on the left side
- layout="right" - Root image appears on the right side
- layout="vertical" - Root image appears at the top

Use all three layouts throughout the presentation for visual variety.

## AVAILABLE LAYOUTS
Choose ONE different layout for each slide:

1. COLUMNS: For comparisons
\`\`\`xml
<COLUMNS>
  <DIV><H3>First Concept</H3><P>Description</P></DIV>
  <DIV><H3>Second Concept</H3><P>Description</P></DIV>
</COLUMNS>
\`\`\`

2. BULLETS: For key points
\`\`\`xml
<BULLETS>
  <DIV><H3>Main Point</H3><P>Description</P></DIV>
  <DIV><P>Second point with details</P></DIV>
</BULLETS>
\`\`\`

3. ICONS: For concepts with symbols
\`\`\`xml
<ICONS>
  <DIV><ICON query="rocket" /><H3>Innovation</H3><P>Description</P></DIV>
  <DIV><ICON query="shield" /><H3>Security</H3><P>Description</P></DIV>
</ICONS>
\`\`\`

4. CYCLE: For processes and workflows
\`\`\`xml
<CYCLE>
  <DIV><H3>Research</H3><P>Initial exploration phase</P></DIV>
  <DIV><H3>Design</H3><P>Solution creation phase</P></DIV>
  <DIV><H3>Implement</H3><P>Execution phase</P></DIV>
  <DIV><H3>Evaluate</H3><P>Assessment phase</P></DIV>
</CYCLE>
\`\`\`

5. ARROWS: For cause-effect or flows
\`\`\`xml
<ARROWS>
  <DIV><H3>Challenge</H3><P>Current market problem</P></DIV>
  <DIV><H3>Solution</H3><P>Our innovative approach</P></DIV>
  <DIV><H3>Result</H3><P>Measurable outcomes</P></DIV>
</ARROWS>
\`\`\`

6. TIMELINE: For chronological progression
\`\`\`xml
<TIMELINE>
  <DIV><H3>2022</H3><P>Market research completed</P></DIV>
  <DIV><H3>2023</H3><P>Product development phase</P></DIV>
  <DIV><H3>2024</H3><P>Global market expansion</P></DIV>
</TIMELINE>
\`\`\`

7. PYRAMID: For hierarchical importance
\`\`\`xml
<PYRAMID>
  <DIV><H3>Vision</H3><P>Our aspirational goal</P></DIV>
  <DIV><H3>Strategy</H3><P>Key approaches to achieve vision</P></DIV>
  <DIV><H3>Tactics</H3><P>Specific implementation steps</P></DIV>
</PYRAMID>
\`\`\`

8. STAIRCASE: For progressive advancement
\`\`\`xml
<STAIRCASE>
  <DIV><H3>Basic</H3><P>Foundational capabilities</P></DIV>
  <DIV><H3>Advanced</H3><P>Enhanced features and benefits</P></DIV>
  <DIV><H3>Expert</H3><P>Premium capabilities and results</P></DIV>
</STAIRCASE>
\`\`\`

9. CHART: For data visualization
\`\`\`xml
<CHART charttype="vertical-bar">
  <TABLE>
    <TR><TD type="label"><VALUE>Q1</VALUE></TD><TD type="data"><VALUE>45</VALUE></TD></TR>
    <TR><TD type="label"><VALUE>Q2</VALUE></TD><TD type="data"><VALUE>72</VALUE></TD></TR>
    <TR><TD type="label"><VALUE>Q3</VALUE></TD><TD type="data"><VALUE>89</VALUE></TD></TR>
  </TABLE>
</CHART>
\`\`\`

10. IMAGES: Most slides needs at least one
\`\`\`xml
<!-- Good image queries (detailed, specific): -->
<IMG query="futuristic smart city with renewable energy infrastructure and autonomous vehicles in morning light" />
<IMG query="close-up of microchip with circuit board patterns in blue and gold tones" />
<IMG query="diverse team of professionals collaborating in modern office with data visualizations" />

<!-- NOT just: "city", "microchip", "team meeting" -->
\`\`\`



## CRITICAL RULES
1. Generate exactly {totalSlides} slides. NOT MORE NOT LESS ! EXACTLY {totalSlides}
2.**USE THE PROVIDED TEXT VERBATIM.** Your task is to structure, not create, content.
3. NEVER repeat layouts in consecutive slides
4. Include at least one detailed image query in most of the slides
5. Use appropriate heading hierarchy
6. Vary the SECTION layout attribute (left/right/vertical) throughout the presentation
   - Use each layout (left, right, vertical) at least twice
   - Don't use the same layout more than twice in a row

Now create a complete XML presentation with {totalSlides} slides that significantly expands on the outline.
`;

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.7,
  streaming: true,
  apiKey: process.env.NANO_BANANA_API_KEY
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, outline, language, tone } =
      (await req.json());

    const presentationTitle = title;
    const slides = outline;
    if (!presentationTitle || !slides || !Array.isArray(slides) || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const prompt = PromptTemplate.fromTemplate(slidesTemplate);
    const stringOutputParser = new StringOutputParser();
    const chain = RunnableSequence.from([prompt, model, stringOutputParser]);

    const stream = await chain.stream({
      presentationTitle,
      slidesJson: JSON.stringify(slides),
      totalSlides: Object.keys(slides).length,
      language,
      tone: tone || "professional",
    });

    return LangChainAdapter.toDataStreamResponse(stream);
  } catch (error) {
    console.error("Error in presentation generation:", error);
    return NextResponse.json(
      { error: "Failed to generate presentation slides" },
      { status: 500 },
    );
  }
}
