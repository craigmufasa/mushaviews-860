export const formatPrice = (price: number | undefined | null): string => {
  // Handle undefined, null, or invalid values
  if (price === undefined || price === null || isNaN(price) || price < 0) {
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
    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    return dateObj.toLocaleDateString('en-US', {
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
  if (num === undefined || num === null || isNaN(num) || num < 0) {
    return '0';
  }
  
  try {
    return num.toLocaleString();
  } catch (error) {
    console.error('Error formatting number:', error);
    return '0';
  }
};