import json
import base64
import logging
import requests as http_requests
from io import BytesIO
from PIL import Image
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings

logger = logging.getLogger(__name__)

GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'

# Single unified prompt — always asks AI to return detected IDs.
# We do the matching ourselves in Python, never rely on AI judgment.
OCR_PROMPT = """
You are an expert AI specialized in reading water meters with high precision.

TASK: Analyze the provided image and:
1. Locate the main mechanical or digital counter display showing cumulative consumption.
2. Extract the exact 5 digits on the main register, including leading zeros (e.g. "00109").
3. Search EVERYWHERE on the meter — the face, casing, brass rim, outer edge, engraved text — for ALL serial numbers, IDs, and numeric codes you can find. Return them as a list.

RULES:
1. Every meter has exactly 5 digits on the main register. Do NOT skip any leading zeros.
2. The "detected_ids" list should contain ALL numbers/serials found on the meter body, casing, and rim — NOT the reading digits.
3. If the image is too blurry, dark, or does not contain a water meter, return confidence 0.

Return ONLY a valid JSON object:
{
  "digits": "<5-digit string>",
  "detected_ids": ["<serial1>", "<serial2>", ...],
  "confidence": <float 0-1>
}
"""


def calculate_reading_value(digits_str):
    """Convert 5-digit string to reading value using the leading-zero rule."""
    digits_str = "".join(digits_str.split())
    if len(digits_str) != 5 or not digits_str.isdigit():
        raise ValueError(f"Reading must be exactly 5 digits: '{digits_str}'")
    
    d1, d2, d3, d4, d5 = digits_str[0], digits_str[1], digits_str[2], digits_str[3], digits_str[4]
    if d1 == '0' and d2 == '0':
        whole = int(d3 + d4)
        decimal = int(d5)
    else:
        whole = int(d1 + d2 + d3 + d4)
        decimal = int(d5)
    return float(f"{whole}.{decimal}")


def check_meter_id_match(expected_id, detected_ids):
    """
    Check if the expected meter ID matches any of the detected IDs.
    Uses case-insensitive substring matching.
    Returns True if any match is found.
    """
    if not expected_id or not detected_ids:
        return False
    expected_clean = expected_id.strip().lower()
    for detected in detected_ids:
        detected_clean = str(detected).strip().lower()
        if not detected_clean or detected_clean == 'null':
            continue
        # Exact match
        if expected_clean == detected_clean:
            return True
        # Substring match: expected is contained in detected (e.g. expected is "666702191" and detected is "sn-666702191")
        if len(expected_clean) >= 4 and expected_clean in detected_clean:
            return True
        # Substring match: detected is contained in expected (e.g. expected is "MTR-00001" and detected is "00001")
        # To avoid false positive on single/double digit noise (e.g. "1", "16", "50", "1.5"),
        # we require the detected ID to have a length of at least 4 characters.
        if len(detected_clean) >= 4 and detected_clean in expected_clean:
            return True
    return False


class DemoOCRView(APIView):
    """
    Live OCR Demo — tries Gemini Vision, falls back to Groq Vision.
    Does NOT create any database records.
    """
    permission_classes = [permissions.AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            img = Image.open(image)
            width, height = img.size
        except Exception:
            return Response({'error': 'Invalid image file'}, status=status.HTTP_400_BAD_REQUEST)

        # Read image bytes
        image.seek(0)
        img_bytes = image.read()
        content_type = image.content_type or 'image/jpeg'

        # Bypassed duplicate checks for live demo to allow trying any photo.
        debug_info = []

        # Try Gemini first
        result, model_used, gemini_err = self._try_gemini(img_bytes, content_type)
        if gemini_err:
            debug_info.append(f"Gemini: {gemini_err}")

        # Fallback to Groq
        if result is None:
            result, model_used, groq_err = self._try_groq(img_bytes, content_type)
            if groq_err:
                debug_info.append(f"Groq: {groq_err}")

        # All failed
        if result is None:
            groq_key = getattr(settings, 'GROQ_API_KEY', '')
            debug_info.append(f"GROQ_KEY_SET: {'yes' if groq_key else 'NO - key is empty!'}")
            return Response({
                'success': False,
                'error': f'AI processing failed. Debug: {" | ".join(debug_info)}'
            })

        digits = result['digits']
        try:
            reading_value = calculate_reading_value(digits)
        except ValueError as e:
            return Response({
                'success': False,
                'error': f'AI reading failed: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve detected casing serial numbers
        detected_ids = result.get('detected_ids') or []

        return Response({
            'success': True,
            'reading': reading_value,
            'confidence': result['confidence'],
            'digits_detected': digits,
            'detected_ids': detected_ids,
            'image_size': f'{width}x{height}',
            'model': model_used,
        })

    def _try_gemini(self, img_bytes, content_type):
        """Try Gemini Vision models."""
        last_err = None
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            for model_name in ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[
                            types.Content(
                                parts=[
                                    types.Part.from_bytes(data=img_bytes, mime_type=content_type),
                                    types.Part.from_text(text=OCR_PROMPT),
                                ]
                            )
                        ]
                    )
                    result = self._parse_response(response.text)
                    if result:
                        display = model_name.replace('gemini-', 'Gemini ').replace('-', ' ').title()
                        return result, f"{display} Vision", None
                except Exception as e:
                    last_err = f"{model_name}: {str(e)[:100]}"
                    if '429' in str(e) or 'RESOURCE_EXHAUSTED' in str(e):
                        logger.warning(f"Rate limited on {model_name}")
                        continue
                    logger.error(f"Gemini {model_name} error: {e}")
                    continue
        except Exception as e:
            last_err = f"setup: {str(e)[:100]}"
            logger.warning(f"Gemini setup failed: {e}")
        return None, None, last_err or 'all models failed'

    def _try_groq(self, img_bytes, content_type):
        """Fallback to Groq Vision API."""
        groq_key = getattr(settings, 'GROQ_API_KEY', '')
        if not groq_key:
            return None, None, 'GROQ_API_KEY not set'

        try:
            b64_image = base64.b64encode(img_bytes).decode('utf-8')
            system_msg = 'You are a water meter OCR reader. Respond with ONLY JSON: {"digits": "<5-digit string>", "detected_ids": ["<serial1>", ...], "confidence": <float 0-1>}'

            res = http_requests.post(
                GROQ_CHAT_URL,
                headers={
                    'Authorization': f'Bearer {groq_key}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': 'meta-llama/llama-4-scout-17b-16e-instruct',
                    'messages': [
                        {
                            'role': 'system',
                            'content': system_msg
                        },
                        {
                            'role': 'user',
                            'content': [
                                {
                                    'type': 'image_url',
                                    'image_url': {
                                        'url': f'data:{content_type};base64,{b64_image}'
                                    }
                                },
                                {
                                    'type': 'text',
                                    'text': OCR_PROMPT
                                }
                            ]
                        }
                    ],
                    'response_format': {'type': 'json_object'},
                    'max_tokens': 200,
                    'temperature': 0.0,
                },
                timeout=45,
            )

            if res.status_code == 200:
                text = res.json()['choices'][0]['message']['content'].strip()
                result = self._parse_response(text)
                if result:
                    return result, 'Groq Llama 4 Scout Vision', None
                return None, None, f'parse failed: {text[:150]}'
            else:
                err = f'HTTP {res.status_code}: {res.text[:150]}'
                logger.warning(f"Groq OCR error: {err}")
                return None, None, err
        except Exception as e:
            logger.warning(f"Groq OCR failed: {e}")
            return None, None, str(e)[:150]

    def _parse_response(self, raw_text):
        """Parse AI response into digits/detected_ids/confidence dict."""
        import re
        try:
            text = raw_text.strip()
            data = None
            
            # Try direct JSON parse first
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                pass

            # Try extracting from markdown fences
            if data is None and '```' in text:
                code_block = text.split('```')[1]
                if code_block.startswith('json'):
                    code_block = code_block[4:]
                code_block = code_block.strip()
                try:
                    data = json.loads(code_block)
                except json.JSONDecodeError:
                    pass

            # Try regex extraction
            if data is None:
                json_match = re.search(r'\{.*\}', text, re.DOTALL)
                if json_match:
                    try:
                        data = json.loads(json_match.group())
                    except json.JSONDecodeError:
                        pass
            
            if data and 'digits' in data:
                detected_ids = data.get('detected_ids', [])
                # Normalize: if AI returned a single string instead of list
                if isinstance(detected_ids, str):
                    detected_ids = [detected_ids] if detected_ids else []
                # Also accept legacy 'meter_id_detected' field
                legacy_id = data.get('meter_id_detected')
                if legacy_id and legacy_id != 'null' and str(legacy_id) not in [str(d) for d in detected_ids]:
                    detected_ids.append(str(legacy_id))
                    
                return {
                    'digits': str(data['digits']),
                    'detected_ids': [str(d) for d in detected_ids if d],
                    'confidence': float(data.get('confidence', 0.5))
                }
                
            # Fallback regex search for digits
            digits_match = re.search(r'"digits"\s*:\s*"([0-9]{5})"', text)
            if not digits_match:
                digits_match = re.search(r'\b([0-9]{5})\b', text)
                
            if digits_match:
                digits_val = digits_match.group(1)
                conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', text)
                return {
                    'digits': digits_val,
                    'detected_ids': [],
                    'confidence': float(conf_match.group(1)) if conf_match else 0.5
                }
                
            logger.warning(f"No valid digits found in: {text[:200]}")
            return None
        except Exception as e:
            logger.warning(f"Failed to parse OCR response: {raw_text[:200]}, err: {e}")
            return None
