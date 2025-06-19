import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Home, Ruler, Calendar, CheckCircle } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { Property } from '@/types/property';
import { formatNumber } from '@/utils/format';

interface PropertyFeaturesProps {
  property: Property;
}

export const PropertyFeatures: React.FC<PropertyFeaturesProps> = ({ property }) => {
  // Convert sqm to sqft (1 sqm = 10.764 sqft)
  const sqftValue = property.sqm ? Math.round(property.sqm * 10.764) : 0;
  
  return (
    <View style={styles.container}>
      <View style={styles.mainFeatures}>
        <View style={styles.featureItem}>
          <Home size={20} color={colors.primary} />
          <Text style={styles.featureValue}>{property.type || 'N/A'}</Text>
          <Text style={styles.featureLabel}>Type</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Ruler size={20} color={colors.primary} />
          <Text style={styles.featureValue}>{formatNumber(sqftValue)}</Text>
          <Text style={styles.featureLabel}>Square Feet</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Calendar size={20} color={colors.primary} />
          <Text style={styles.featureValue}>{property.yearBuilt || 'N/A'}</Text>
          <Text style={styles.featureLabel}>Year Built</Text>
        </View>
      </View>
      
      <Text style={styles.featuresTitle}>Features</Text>
      <View style={styles.featuresList}>
        {(property.features || []).map((feature, index) => (
          <View key={index} style={styles.featureListItem}>
            <CheckCircle size={16} color={colors.primary} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  mainFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  featureLabel: {
    fontSize: 12,
    color: colors.textLight,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 12,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: colors.text,
  },
});