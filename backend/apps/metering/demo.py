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

OCR_PROMPT = """
You are an expert AI specialized in reading water meters with high precision.

TASK: Analyze the provided image and extract the main water consumption reading.

RULES:
1. Focus ONLY on the mechanical or digital counter display showing cumulative consumption.
2. Read ALL visible digits on the main register, including leading zeros.
3. If the meter has a decimal/fractional portion, include it after a decimal point.
4. IGNORE: serial numbers, barcodes, QR codes, model/brand text.
5. If the image is too blurry or does not contain a water meter, return confidence 0.

Return ONLY valid JSON:
{"reading": <number>, "confidence": <float 0-1>}
"""


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

        return Response({
            'success': True,
            'reading': result['reading'],
            'confidence': result['confidence'],
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

            for model_name in ['gemini-2.0-flash', 'gemini-2.0-flash-lite']:
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
                            'content': 'You are a water meter OCR reader. You MUST respond with ONLY a JSON object, no explanation, no markdown, no text before or after. Format: {"reading": <number>, "confidence": <float 0-1>}'
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
                                    'text': 'Read the water meter in this image. Return ONLY JSON: {"reading": <number>, "confidence": <float 0-1>}. NO other text.'
                                }
                            ]
                        }
                    ],
                    'max_tokens': 100,
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
        """Parse AI response into reading/confidence dict."""
        import re
        try:
            text = raw_text.strip()
            # Try direct JSON parse first
            try:
                result = json.loads(text)
                if 'reading' in result:
                    return {'reading': result['reading'], 'confidence': result.get('confidence', 0)}
            except json.JSONDecodeError:
                pass

            # Try extracting from markdown fences
            if '```' in text:
                code_block = text.split('```')[1]
                if code_block.startswith('json'):
                    code_block = code_block[4:]
                code_block = code_block.strip()
                try:
                    result = json.loads(code_block)
                    if 'reading' in result:
                        return {'reading': result['reading'], 'confidence': result.get('confidence', 0)}
                except json.JSONDecodeError:
                    pass

            # Try regex extraction from verbose text
            json_match = re.search(r'\{[^{}]*"reading"\s*:\s*[\d.]+[^{}]*\}', text)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                    return {'reading': result['reading'], 'confidence': result.get('confidence', 0)}
                except json.JSONDecodeError:
                    pass

            # Last resort: extract numbers with regex
            reading_match = re.search(r'"reading"\s*:\s*([\d.]+)', text)
            conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', text)
            if reading_match:
                return {
                    'reading': float(reading_match.group(1)),
                    'confidence': float(conf_match.group(1)) if conf_match else 0.5,
                }

            logger.warning(f"No reading found in: {text[:200]}")
            return None
        except Exception:
            logger.warning(f"Failed to parse OCR response: {raw_text[:200]}")
            return None
