/** Thai and international numbers: digits with optional +, spaces, dashes and brackets. */
export const PHONE_REGEX = /^$|^[0-9+\-\s()]{9,15}$/;
export const PHONE_MESSAGE = 'Enter a valid phone number';
