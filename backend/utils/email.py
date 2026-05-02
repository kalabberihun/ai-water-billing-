from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_html_email(subject, template_name, context, recipient_list, **kwargs):
    """
    Sends an HTML email with a plain-text fallback.
    
    Args:
        subject (str): The email subject.
        template_name (str): The HTML template name (e.g. 'emails/otp_verification.html')
        context (dict): Context variables for the template.
        recipient_list (list): List of recipient email addresses.
        **kwargs: Additional arguments to pass to send_mail (e.g. fail_silently)
    """
    try:
        # Add a default frontend_url if not in context
        if 'frontend_url' not in context:
            context['frontend_url'] = 'http://localhost:3000' if settings.DEBUG else 'https://yourdomain.com'
            
        html_message = render_to_string(template_name, context)
        plain_message = strip_tags(html_message)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            html_message=html_message,
            **kwargs
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send HTML email '{subject}' to {recipient_list}: {e}")
        return False
