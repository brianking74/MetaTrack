
import { GoogleGenAI } from "@google/genai";
import { Assessment } from "../types";

// Refactored to follow @google/genai coding guidelines strictly
export const analyzeAssessment = async (assessment: Assessment): Promise<string> => {
  // Always initialize with the apiKey from process.env.API_KEY directly
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
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
      }
    });

    // Correctly extracting text using the .text property
    return response.text || "No analysis generated.";
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
