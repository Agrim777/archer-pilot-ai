import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { GenerateArcherImplementationBody, SendCopilotMessageBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function getAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const GENERATE_SYSTEM_PROMPT = `You are an expert RSA Archer GRC consultant with deep knowledge of the Archer platform.
Given a user's description of an Archer application, generate a comprehensive implementation plan in JSON.

Return ONLY a valid JSON object with this exact structure:
{
  "businessOverview": "string - 2-3 paragraph business context and rationale",
  "useCases": ["string array of 5-8 specific use cases"],
  "applicationStructure": {
    "name": "string",
    "description": "string",
    "type": "string e.g. Questionnaire, Standard Application",
    "level": "number (1-5)",
    "status": "Active"
  },
  "modules": [
    {"name": "string", "description": "string", "type": "string", "order": 1}
  ],
  "fields": [
    {"name": "string", "type": "string e.g. Text, Date, Values List, Cross-Reference, Number", "module": "string", "required": true, "description": "string", "systemId": "string"}
  ],
  "valueLists": [
    {"name": "string", "values": ["string array"], "description": "string"}
  ],
  "crossReferences": [
    {"name": "string", "sourceApplication": "string", "targetApplication": "string", "description": "string"}
  ],
  "questionnaires": [
    {"name": "string", "description": "string", "questions": [{"text": "string", "type": "string", "required": true}]}
  ],
  "workflow": {
    "name": "string",
    "stages": [{"name": "string", "description": "string", "order": 1, "nodeType": "string"}],
    "transitions": [{"from": "string", "to": "string", "action": "string"}],
    "notifications": ["string array of notification triggers"]
  },
  "recordPermissions": [
    {"group": "string", "read": true, "create": true, "update": true, "delete": false}
  ],
  "notifications": [
    {"name": "string", "trigger": "string", "recipients": ["string"], "template": "string"}
  ],
  "reports": [
    {"name": "string", "type": "string e.g. Summary, Detail, Matrix", "description": "string", "fields": ["string"]}
  ],
  "dashboards": [
    {"name": "string", "description": "string", "charts": [{"type": "string", "title": "string", "dataSource": "string"}]}
  ],
  "sampleRecords": [
    {"recordName": "string", "fields": {}}
  ],
  "testCases": [
    {"id": "string", "name": "string", "steps": ["string"], "expectedResult": "string"}
  ]
}

Be thorough, realistic, and enterprise-grade. Generate at least 5 fields, 2 modules, 3 workflow stages, and 3 test cases.`;

const COPILOT_SYSTEM_PROMPT = `You are an expert RSA Archer GRC consultant and implementation specialist.
You help consultants understand, design, and implement RSA Archer applications.
Topics you excel at: Cross References, Workflows, Record Permissions, Value Lists, Fields, Modules, Questionnaires, Reports, Dashboards, API integration, best practices, and troubleshooting.
Be concise, technical, and practical. Use Archer terminology correctly.`;

// POST /ai/generate
router.post("/ai/generate", requireAuth, async (req, res) => {
  const parsed = GenerateArcherImplementationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${GENERATE_SYSTEM_PROMPT}\n\nGenerate an RSA Archer implementation for:\n${parsed.data.prompt}`,
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "{}";
    let implementation: Record<string, unknown>;
    try {
      implementation = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response
      const match = text.match(/\{[\s\S]*\}/);
      implementation = match ? JSON.parse(match[0]) : {};
    }

    res.json(implementation);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate implementation. Check your Gemini API key." });
  }
});

// POST /ai/copilot (SSE streaming)
router.post("/ai/copilot", requireAuth, async (req, res) => {
  const parsed = SendCopilotMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const ai = getAI();
    const { message, history = [] } = parsed.data;

    const contents = [
      {
        role: "user" as const,
        parts: [{ text: COPILOT_SYSTEM_PROMPT }],
      },
      ...history.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
      {
        role: "user" as const,
        parts: [{ text: message }],
      },
    ];

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err);
    res.write(`data: ${JSON.stringify({ error: "AI service error" })}\n\n`);
    res.end();
  }
});

export default router;
