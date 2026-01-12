import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  Platform 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* 1. TOP SECTION */}
      <View style={styles.topSection}>
        {/* THE IMAGE - Now set to fill the container */}
        <Image 
          source={require('../../assets/arch.jpg')} 
          style={styles.fullImage}
          resizeMode="cover" // This makes it fill the space
        />

        {/* 2. THE CURVE (Acts as a mask over the bottom of the image) */}
        <View style={styles.curveContainer}>
          <View style={styles.curveShape} />
        </View>
      </View>

      {/* 3. BOTTOM SECTION */}
      <View style={styles.bottomSection}>
        <View style={styles.textContainer}>
          
          <Text style={styles.mainTitle}>ARCH LENS</Text>
          <Text style={styles.description}>Plan Your Dream Home and Estimate the Cost
            Transform your floor plans into accurate material estimates instantly.
          </Text>
        </View>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topSection: {
    height: height * 0.60, // Increased height to show more image
    width: width,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3E9EB',
  },
  fullImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1, // Sits behind the curve
  },
  curveContainer: {
    position: 'absolute',
    bottom: 0,
    width: width,
    height: 120, // Height of the curve area
    zIndex: 10, // Higher than image to "cut" the bottom
  },
  curveShape: {
    position: 'absolute',
    bottom: -width * 1.75, // Adjust this to make the "dip" deeper or shallower
    alignSelf: 'center',
    width: width * 2,
    height: width * 2,
    borderRadius: width,
    backgroundColor: '#FFFFFF', // Matches the bottom section background
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 40,
    paddingHorizontal: 40,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  subTitle: {
    fontSize: 18,
    color: '#889fbb',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  mainTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#315b76',
    letterSpacing: 2,
    marginVertical: 8,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#14465b',
    lineHeight: 22,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  activeDot: {
    width: 25,
    backgroundColor: '#315b76',
  },
 button: {
    backgroundColor: '#315b76',
    width: width * 0.7,
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 30,
    borderColor: '#cddefe',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  },
});