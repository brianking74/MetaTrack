
import { GoogleGenAI } from "@google/genai";
import { Assessment } from "../types";

export const analyzeAssessment = async (assessment: Assessment): Promise<string> => {
  if (!process.env.API_KEY) return "AI Analysis is unavailable: API Key not configured.";
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      Analyze the following performance appraisal for ${assessment.employeeDetails.fullName}. 
      Provide a concise summary for the manager focusing on:
      1. Key achievements based on employee comments.
      2. Potential areas for development.
      3. A suggested overall rating based on the provided evidence.

      Employee Data:
      KPIs: ${JSON.stringify(assessment.kpis.map(k => ({ title: k.title, selfRating: k.selfRating, selfComments: k.selfComments })))}
      Development Plan: ${assessment.developmentPlan.selfComments}
      Overall Self-Comments: ${assessment.overallPerformance.selfComments}
    `,
    config: {
      temperature: 0.7,
      maxOutputTokens: 500,
    }
  });

  try {
    const result = await model;
    return result.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Error generating AI analysis. Please check your connection or API key.";
  }
};
