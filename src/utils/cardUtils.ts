export const generateCardNumber = (): string => {
  // Generate a random 16-digit card number
  const prefix = '4'; // Visa card prefix
  const remainingDigits = Array.from({ length: 15 }, () => 
    Math.floor(Math.random() * 10)
  ).join('');
  
  return prefix + remainingDigits;
};

export const formatCardNumber = (cardNumber: string): string => {
  // Remove any non-digit characters
  const cleaned = cardNumber.replace(/\D/g, '');
  // Add spaces every 4 digits
  return cleaned.replace(/(\d{4})/g, '$1 ').trim();
}; 