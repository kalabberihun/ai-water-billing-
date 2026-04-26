"""
Chapa Payment Gateway Service Module

Handles communication with the Chapa API for initializing
and verifying payment transactions.
"""

import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

CHAPA_BASE_URL = getattr(settings, 'CHAPA_API_BASE_URL', 'https://api.chapa.co/v1')
CHAPA_SECRET_KEY = getattr(settings, 'CHAPA_SECRET_KEY', '')


def _get_headers():
    """Return authorization headers for Chapa API calls."""
    return {
        'Authorization': f'Bearer {CHAPA_SECRET_KEY}',
        'Content-Type': 'application/json',
    }


def initialize_transaction(
    amount,
    email,
    first_name,
    last_name,
    tx_ref,
    callback_url,
    return_url,
    currency='ETB',
    phone_number=None,
):
    """
    Initialize a Chapa payment transaction.

    Returns:
        dict: Chapa API response containing 'checkout_url' on success.
        None: If the request fails.
    """
    url = f'{CHAPA_BASE_URL}/transaction/initialize'

    payload = {
        'amount': str(amount),
        'currency': currency,
        'email': email,
        'first_name': first_name,
        'last_name': last_name,
        'tx_ref': tx_ref,
        'callback_url': callback_url,
        'return_url': return_url,
        'customization[title]': 'Water Bill Payment',
        'customization[description]': f'Payment for water bill - Ref: {tx_ref}',
    }

    if phone_number:
        payload['phone_number'] = phone_number

    try:
        logger.info(f'Chapa: Initializing transaction {tx_ref} for {amount} {currency}')
        response = requests.post(url, json=payload, headers=_get_headers(), timeout=30)
        data = response.json()

        if response.status_code == 200 and data.get('status') == 'success':
            logger.info(f'Chapa: Transaction {tx_ref} initialized successfully')
            return data
        else:
            logger.error(f'Chapa: Failed to initialize transaction {tx_ref}: {data}')
            return None

    except requests.RequestException as e:
        logger.error(f'Chapa: Request error during initialization: {e}')
        return None


def verify_transaction(tx_ref):
    """
    Verify the status of a Chapa transaction.

    Returns:
        dict: Chapa API response with transaction details.
        None: If the request fails.
    """
    url = f'{CHAPA_BASE_URL}/transaction/verify/{tx_ref}'

    try:
        logger.info(f'Chapa: Verifying transaction {tx_ref}')
        response = requests.get(url, headers=_get_headers(), timeout=30)
        data = response.json()

        if response.status_code == 200 and data.get('status') == 'success':
            logger.info(f'Chapa: Transaction {tx_ref} verified - status: {data.get("data", {}).get("status")}')
            return data
        else:
            logger.error(f'Chapa: Failed to verify transaction {tx_ref}: {data}')
            return None

    except requests.RequestException as e:
        logger.error(f'Chapa: Request error during verification: {e}')
        return None
