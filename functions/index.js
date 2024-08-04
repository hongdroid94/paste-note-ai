const functions = require('firebase-functions');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Google AI API 키 설정
const API_KEY = 'AIzaSyB0e00Mrh_y0eVW0QZpU7op4pTk_TJT6fg';
const genAI = new GoogleGenerativeAI(API_KEY);

exports.analyzeText = functions.https.onCall(async (data, context) => {
  // CORS 및 COOP 헤더 설정
  // Note: onCall 함수에서는 직접 헤더를 설정할 수 없습니다.
  // Firebase가 자동으로 CORS를 처리합니다.

  // 인증 확인
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '인증되지 않은 사용자입니다.');
  }

  const { text } = data;
  if (!text) {
    throw new functions.https.HttpsError('invalid-argument', '분석할 텍스트가 없습니다.');
  }

  try {
    const analysis = await callGeminiAPI(text);
    return analysis;
  } catch (error) {
    console.error('Gemini API 호출 중 오류:', error);
    throw new functions.https.HttpsError('internal', '분석 중 오류가 발생했습니다.');
  }
});

async function callGeminiAPI(text) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
      다음 텍스트를 분석하여 제목, 카테고리, 그리고 요약을 생성해야 합니다. 어떠한 텍스트더라도 분석할 수 있어야 합니다.
      예를 들어 URL 형태의 링크 주소라면 카테고리는 '링크'이고, 제목도 URL의 작성된 단어들을 최대한 이해해서 달아줘야 합니다.
      개발 코드 형태의 텍스트를 전달받으면 '개발 코드'라고 분류한 뒤 개발 코드의 대략적인 프로그래밍 언어를 기반으로 제목을 생성해낼 수 있어야 합니다:
      
      텍스트:
      ${text}
      
      다음 형식으로 응답해주세요:
      제목: [생성된 제목]
      카테고리: [추천 카테고리]
      요약: [텍스트 요약]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text();

    return parseResponse(analysisText);
  } catch (error) {
    console.error('Gemini API 호출 중 오류:', error);
    return {
      title: '제목 없음',
      category: '미분류',
      summary: '요약을 생성할 수 없습니다.'
    };
  }
}

function parseResponse(text) {
  const lines = text.split('\n');
  const analysis = {
    title: '제목 없음',
    category: '미분류',
    summary: '요약을 생성할 수 없습니다.'
  };

  lines.forEach(line => {
    if (line.startsWith('제목:')) {
      analysis.title = line.replace('제목:', '').trim() || '제목 없음';
    } else if (line.startsWith('카테고리:')) {
      analysis.category = line.replace('카테고리:', '').trim() || '미분류';
    } else if (line.startsWith('요약:')) {
      analysis.summary = line.replace('요약:', '').trim() || '요약을 생성할 수 없습니다.';
    }
  });

  return analysis;
}