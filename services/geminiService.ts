import { GoogleGenAI, Type } from "@google/genai";
import { RecognitionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
# Role
你是一个高精度的计算机视觉增强现实（AR）指令引擎。你的任务是分析用户上传的摄像头画面（视频帧或图像），精准识别画面中的“柱状物体”。

# Task
1. 识别：扫描画面，寻找明确的柱状物体（如：筷子、吸管、笔、圆柱形木棍、长柄汤匙等）。
2. 定位：确定该物体的几何中心线，并定位到其“朝上”或“尖端”的一个端点。 **必须紧贴物体末端，不要偏离。**
3. 输出：在识别到的端点位置，实时生成“仙女棒烟花”的视觉特效指令。

# Recognition Logic (为了避免误报)
- 必须具备明显的长宽比（长度远大于宽度）。
- 边缘必须相对平行。
- 忽略非刚性物体（如垂下的绳子）或不规则物体。
- 优先识别用户手中握持的柱状目标。
- 坐标点 (top_point) 必须位于物体实体的最顶端中心，而不是背景中。

# Output Format (JSON)
请始终以 JSON 格式输出，以便程序解析坐标。如果画面中没有符合条件的物体，输出空数组。
输出包含：
- label: 物体名称
- confidence: 置信度 (0-1)
- top_point: {x, y} (烟花爆发的起始坐标，归一化到 0-1000)
- effect: "sparkler_fireworks"

# Tone
仅输出数据指令，不进行任何文字解释或闲聊。
`;

export const analyzeFrame = async (base64Image: string): Promise<RecognitionResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
             text: "Detect the object and return the result in JSON.",
          }
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              top_point: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                },
              },
              effect: { type: Type.STRING },
            },
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return null;

    const data = JSON.parse(jsonText);
    if (Array.isArray(data) && data.length > 0) {
      // Filter to ensure top_point and its coordinates exist
      const validItems = data.filter(item => 
        item && 
        item.top_point && 
        typeof item.top_point.x === 'number' && 
        typeof item.top_point.y === 'number'
      );

      if (validItems.length === 0) return null;

      // Return the detection with the highest confidence
      return validItems.reduce((prev, current) => (prev.confidence > current.confidence) ? prev : current);
    }

    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};