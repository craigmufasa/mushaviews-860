export const formatPrice = (price: number | undefined): string => {
  if (!price || price === 0) return 'Price not available';
  return `$${price.toLocaleString()}`;
};

export const formatNumber = (num: number | undefined): string => {
  if (!num || num === 0) return '0';
  return num.toLocaleString();
};

export const formatAddress = (property: any): string => {
  if (!property) return 'Address not available';
  
  const parts = [];
  if (property.address) parts.push(property.address);
  if (property.city) parts.push(property.city);
  if (property.state) parts.push(property.state);
  if (property.zipCode) parts.push(property.zipCode);
  
  return parts.length > 0 ? parts.join(', ') : 'Address not available';
};

export const formatDate = (date: string | Date | undefined): string => {
  if (!date) return 'Date not available';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Date not available';
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return 'Date not available';
  }
};