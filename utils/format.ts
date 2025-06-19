export const formatPrice = (price: number): string => {
  // Handle undefined or null values
  if (price === undefined || price === null || isNaN(price)) {
    return 'Price not available';
  }
  
  // For prices over 1 million, format as $X.XM
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  
  // For rental prices under 10000, assume it's monthly rent
  if (price < 10000) {
    return `$${price.toLocaleString()}/mo`;
  }
  
  // Otherwise format with commas
  return `$${price.toLocaleString()}`;
};

export const formatDate = (date: Date | string | undefined | null): string => {
  if (!date) {
    return 'Date not available';
  }
  
  try {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Date not available';
  }
};

export const formatAddress = (property: { address?: string; city?: string; state?: string } | null | undefined): string => {
  if (!property) {
    return 'Address not available';
  }
  
  const { address = '', city = '', state = '' } = property;
  
  if (!address && !city && !state) {
    return 'Address not available';
  }
  
  const parts = [address, city, state].filter(part => part && part.trim());
  return parts.join(', ');
};

export const formatNumber = (num: number | undefined | null): string => {
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  
  return num.toLocaleString();
};