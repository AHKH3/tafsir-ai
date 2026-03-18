import { LessonFormData } from '../App';
import { GoogleGenerativeAI } from '@google/genai';

// Note: Using the standard fetch API for ease of browser usage if the SDK gives issues,
// but the prompt specified installing @google/genai. We'll use the official SDK.
// Wait, SDK v0.1.x (@google/genai) might require specific import or initialization.
// A simpler robust way for a browser app without backend is direct REST API for Gemini to avoid CORS issues if SDK is Node-only, but let's try standard fetch to be safe.

export interface SlidePlan {
  id: string;
  type: 'intro' | 'verse' | 'vocabulary' | 'insight' | 'story' | 'question' | 'review' | 'closing' | string;
  objective: string;
  topic: string;
  // Generated in stage 2
  title?: string;
  core_content?: string;
  visual_suggestion?: string;
  interactive_element?: string;
}

export type ProgressCallback = (stage: 'planning' | 'generating' | 'error', message: string) => void;

/**
 * Executes the entire multi-stage agentic workflow to generate the lesson.
 */
export async function generateLessonWorkflow(
  formData: LessonFormData,
  onProgress: ProgressCallback
): Promise<SlidePlan[]> {
  
  const apiKey = formData.apiKey;
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const callGemini = async (systemPrompt: string, userPrompt: string, responseFormat: string = 'text') => {
    const payload: any = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.2, // Low temperature for consistent JSON/structure
      }
    };
    
    if (responseFormat === 'json') {
      payload.generationConfig.responseMimeType = "application/json";
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  };

  // ----------------------------------------------------------------------
  // STAGE 1: ASSESSMENT & PLANNING
  // ----------------------------------------------------------------------
  onProgress('planning', 'Architecting lesson flow and structure (Stage 1)...');

  const planningSystemPrompt = `
    You are an expert Islamic instructional designer.
    Based on the constraints below, produce a structured JSON array representing the lesson plan.
    Each object in the array represents ONE slide.
    
    Slide types available: intro, verse, vocabulary, insight, story, question, review, closing.
    
    Output strictly a JSON array of objects with this schema:
    [
      {
        "id": "slide_1",
        "type": "intro",
        "objective": "Hook the students and introduce the topic",
        "topic": "Brief description of what goes on this slide"
      }
    ]
  `;

  const planningUserPrompt = `
    Design a Tafsir lesson for:
    - Surah: ${formData.surahName}
    - Verses: ${formData.verseRange || 'Full Surah'}
    - Purpose: ${formData.lessonPurpose}
    - Audience: ${formData.ageGroup}, ${formData.languageBackground}, ${formData.academicLevel}
    - Target Slide Count: ${formData.slideCount}
    
    Include these sections if true:
    ${JSON.stringify(formData.sections, null, 2)}
    
    Special Instructions: ${formData.specialInstructions || 'None'}
  `;

  let outlineJsonStr = await callGemini(planningSystemPrompt, planningUserPrompt, 'json');
  let outline: SlidePlan[];
  try {
    // Sometimes LLM wraps json in markdown
    if (outlineJsonStr.startsWith('\`\`\`json')) {
      outlineJsonStr = outlineJsonStr.replace(/\`\`\`json\n/g, '').replace(/\`\`\`/g, '');
    }
    outline = JSON.parse(outlineJsonStr) as SlidePlan[];
  } catch (e) {
    throw new Error('Failed to parse the lesson plan from AI. ' + outlineJsonStr);
  }

  // ----------------------------------------------------------------------
  // STAGE 2: CONTENT GENERATION
  // ----------------------------------------------------------------------
  const totalSlides = outline.length;
  // We will process slides in batches to avoid timeout constraints
  const batchSize = 5; 
  
  for (let i = 0; i < totalSlides; i += batchSize) {
    const batch = outline.slice(i, i + batchSize);
    onProgress('generating', \`Researching Tafsir and generating content (Slides \${i+1} to \${Math.min(i+batchSize, totalSlides)} of \${totalSlides})...\`);
    
    const contentSystemPrompt = \`
      You are an expert Tafsir Scholar and Teacher.
      Generate precise, age-appropriate content for a batch of slides.
      
      RULES:
      - Arabic text must have full tashkeel (diacritics).
      - Content must align with classical sources (Ibn Kathir, Al-Tabari).
      - Authentic Hadith ONLY.
      - Density constraint: \${formData.slideDensity}. Keep text extremely concise to prevent overcrowding.
      - Tone: \${formData.tone}.
      - Language: \${formData.deliveryLanguage} (Complexity: \${formData.languageComplexity}).
      
      You will receive a JSON array of slide outlines. Return the exact SAME JSON array, but populate the following fields for EACH slide:
      - "title": string (Slide headline)
      - "core_content": string (The main instructional text / Tafsir. Keep it concise!)
      - "visual_suggestion": string (Suggestions like 'Icon: Book', 'Highlight Box', 'Emoji: 💡')
      - "interactive_element": string (Optional: a question, reflection prompt, or activity. Empty if not needed)

      OUTPUT MINIFIED JSON ONLY.
    \`;

    const contentUserPrompt = JSON.stringify(batch, null, 2);

    let batchResultJson = await callGemini(contentSystemPrompt, contentUserPrompt, 'json');
    try {
      if (batchResultJson.startsWith('\`\`\`json')) {
        batchResultJson = batchResultJson.replace(/\`\`\`json\n/g, '').replace(/\`\`\`/g, '');
      }
      const populatedBatch = JSON.parse(batchResultJson) as SlidePlan[];
      
      // Update original outline
      for (let j = 0; j < populatedBatch.length; j++) {
        outline[i + j] = { ...outline[i + j], ...populatedBatch[j] };
      }
    } catch (e) {
      throw new Error('Failed to parse generation content from AI for batch ' + i);
    }
  }

  return outline;
}
