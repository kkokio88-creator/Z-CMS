import { Router, Request, Response } from 'express';
import { google, sheets_v4 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// 스프레드시트 URL에서 ID 추출
function extractSpreadsheetId(url: string): string | null {
  // URL 형식: https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit...
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  // 이미 ID만 전달된 경우
  if (/^[a-zA-Z0-9-_]+$/.test(url)) {
    return url;
  }
  return null;
}

// Google Sheets 클라이언트 가져오기
async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  // Method 1: GOOGLE_SERVICE_ACCOUNT_JSON env var (for cloud deployments)
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient as any });
  }

  // Method 2: Service account key file path
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (serviceAccountPath) {
    const keyFilePath = path.resolve(serviceAccountPath);

    if (fs.existsSync(keyFilePath)) {
      const keyFileContent = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));

      const auth = new google.auth.GoogleAuth({
        credentials: keyFileContent,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const authClient = await auth.getClient();
      return google.sheets({
        version: 'v4',
        auth: authClient as any,
      });
    }
  }

  throw new Error('서비스 계정 키 파일이 설정되지 않았습니다.');
}

/**
 * POST /api/sheets/test-connection
 * Google Sheets 연결 테스트
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { spreadsheetUrl, sheetName } = req.body;

    if (!spreadsheetUrl) {
      return res.json({
        success: false,
        message: '스프레드시트 URL을 입력해주세요.',
      });
    }

    if (!sheetName) {
      return res.json({
        success: false,
        message: '시트 이름을 입력해주세요.',
      });
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      return res.json({
        success: false,
        message: '유효한 Google Sheets URL이 아닙니다.',
      });
    }

    const sheets = await getSheetsClient();

    // 1. 스프레드시트 메타데이터 가져오기
    const metadataResponse = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const spreadsheetTitle = metadataResponse.data.properties?.title;
    const availableSheets = metadataResponse.data.sheets?.map(s => s.properties?.title || '') || [];

    // 2. 지정된 시트가 존재하는지 확인
    const sheetExists = availableSheets.some(s => s.toLowerCase() === sheetName.toLowerCase());

    if (!sheetExists) {
      return res.json({
        success: false,
        message: `시트 "${sheetName}"을(를) 찾을 수 없습니다. 사용 가능한 시트: ${availableSheets.join(', ')}`,
        availableSheets,
        spreadsheetTitle,
      });
    }

    // 3. 시트 데이터 샘플 가져오기 (헤더만)
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:Z1`,
    });

    const headers = dataResponse.data.values?.[0] || [];

    // 4. 전체 행 수 확인
    const fullDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    });

    const rowCount = (fullDataResponse.data.values?.length || 1) - 1; // 헤더 제외

    return res.json({
      success: true,
      message: `연결 성공! "${spreadsheetTitle}" - "${sheetName}" (${rowCount}행, ${headers.length}열)`,
      spreadsheetTitle,
      sheetName,
      headers,
      rowCount,
      columnCount: headers.length,
      availableSheets,
    });
  } catch (error: any) {
    console.error('Google Sheets 연결 테스트 실패:', error);

    let errorMessage = '연결 실패: ';

    if (error.code === 403) {
      errorMessage +=
        '접근 권한이 없습니다. 서비스 계정(z-cms-bot@z-cms-486204.iam.gserviceaccount.com)에 편집 권한을 공유해주세요.';
    } else if (error.code === 404) {
      errorMessage += '스프레드시트를 찾을 수 없습니다. URL을 확인해주세요.';
    } else if (error.message?.includes('credentials')) {
      errorMessage += '서비스 계정 인증 정보가 설정되지 않았습니다.';
    } else {
      errorMessage += error.message || '알 수 없는 오류';
    }

    return res.json({
      success: false,
      message: errorMessage,
    });
  }
});

/**
 * GET /api/sheets/list-sheets
 * 스프레드시트의 모든 시트 목록 가져오기
 */
router.get('/list-sheets', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.json({
        success: false,
        message: 'URL 파라미터가 필요합니다.',
      });
    }

    const spreadsheetId = extractSpreadsheetId(url);
    if (!spreadsheetId) {
      return res.json({
        success: false,
        message: '유효한 Google Sheets URL이 아닙니다.',
      });
    }

    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetNames = response.data.sheets?.map(s => s.properties?.title || '') || [];

    return res.json({
      success: true,
      spreadsheetTitle: response.data.properties?.title,
      sheets: sheetNames,
    });
  } catch (error: any) {
    return res.json({
      success: false,
      message: error.message || '시트 목록을 가져오는데 실패했습니다.',
    });
  }
});

/**
 * GET /api/sheets/preview
 * 시트 데이터 미리보기 (처음 5행)
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const { url, sheet } = req.query;

    if (!url || typeof url !== 'string') {
      return res.json({ success: false, message: 'URL 파라미터가 필요합니다.' });
    }

    if (!sheet || typeof sheet !== 'string') {
      return res.json({ success: false, message: '시트 이름이 필요합니다.' });
    }

    const spreadsheetId = extractSpreadsheetId(url);
    if (!spreadsheetId) {
      return res.json({ success: false, message: '유효한 Google Sheets URL이 아닙니다.' });
    }

    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheet}!A1:Z6`, // 헤더 + 5행
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const data = rows.slice(1);

    return res.json({
      success: true,
      headers,
      data,
      previewRows: data.length,
    });
  } catch (error: any) {
    return res.json({
      success: false,
      message: error.message || '데이터 미리보기에 실패했습니다.',
    });
  }
});

/**
 * POST /api/sheets/fetch-data
 * 시트 전체 데이터 가져오기 (헤더를 키로 하는 객체 배열 반환)
 */
router.post('/fetch-data', async (req: Request, res: Response) => {
  try {
    const { spreadsheetUrl, sheetName } = req.body;

    if (!spreadsheetUrl || !sheetName) {
      return res.json({
        success: false,
        data: [],
        error: 'spreadsheetUrl과 sheetName이 필요합니다.',
      });
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      return res.json({
        success: false,
        data: [],
        error: '유효한 Google Sheets URL이 아닙니다.',
      });
    }

    const sheets = await getSheetsClient();

    // 전체 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:ZZ`, // 모든 열
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.json({
        success: true,
        data: [],
        rowCount: 0,
      });
    }

    // 첫 행을 헤더로 사용
    const headers = rows[0] as string[];
    const dataRows = rows.slice(1);

    // 객체 배열로 변환
    const data = dataRows.map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        if (header) {
          const value = row[idx] || '';
          // 숫자로 변환 시도
          const numValue = parseFloat(String(value).replace(/,/g, ''));
          obj[header] = isNaN(numValue) ? value : numValue;
        }
      });
      return obj;
    });

    return res.json({
      success: true,
      data,
      rowCount: data.length,
      headers,
    });
  } catch (error: any) {
    console.error('시트 데이터 조회 실패:', error);

    let errorMessage = '데이터 조회 실패: ';
    if (error.code === 403) {
      errorMessage += '접근 권한이 없습니다.';
    } else if (error.code === 404) {
      errorMessage += '스프레드시트를 찾을 수 없습니다.';
    } else {
      errorMessage += error.message || '알 수 없는 오류';
    }

    return res.json({
      success: false,
      data: [],
      error: errorMessage,
    });
  }
});

/**
 * POST /api/sheets/fetch-all-configured
 * 설정된 모든 데이터 소스에서 데이터 가져오기
 */
router.post('/fetch-all-configured', async (req: Request, res: Response) => {
  try {
    const { config } = req.body;

    if (!config) {
      return res.json({
        success: false,
        error: '데이터 소스 설정이 필요합니다.',
      });
    }

    const sheets = await getSheetsClient();
    const results: Record<string, any> = {};

    // 각 데이터 소스별로 데이터 가져오기
    const sourceKeys = Object.keys(config);

    for (const key of sourceKeys) {
      const sourceConfig = config[key];

      if (sourceConfig.type === 'googleSheets' && sourceConfig.googleSheets?.spreadsheetUrl) {
        const spreadsheetId = extractSpreadsheetId(sourceConfig.googleSheets.spreadsheetUrl);

        if (spreadsheetId) {
          try {
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: `${sourceConfig.googleSheets.sheetName}!A:ZZ`,
            });

            const rows = response.data.values || [];
            if (rows.length > 0) {
              const headers = rows[0] as string[];
              const dataRows = rows.slice(1);

              results[key] = {
                success: true,
                data: dataRows.map(row => {
                  const obj: Record<string, any> = {};
                  headers.forEach((header, idx) => {
                    if (header) {
                      const value = row[idx] || '';
                      const numValue = parseFloat(String(value).replace(/,/g, ''));
                      obj[header] = isNaN(numValue) ? value : numValue;
                    }
                  });
                  return obj;
                }),
                rowCount: dataRows.length,
                headers,
              };
            } else {
              results[key] = { success: true, data: [], rowCount: 0 };
            }
          } catch (err: any) {
            results[key] = {
              success: false,
              data: [],
              error: err.message,
            };
          }
        }
      }
    }

    return res.json({
      success: true,
      results,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.json({
      success: false,
      error: error.message || '데이터 조회 중 오류 발생',
    });
  }
});

export default router;
