import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Dimensions, 
  SafeAreaView 
} from 'react-native';
import { auth } from '@archlens/shared';
import { signOut } from 'firebase/auth';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error("Logout Failed", error.message);
    }
  };

  const DashboardCard = ({ title, subtext, image, onPress }: any) => (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardTextContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtext}>{subtext}</Text>
      </View>
      <Image source={image} style={styles.cardImage} resizeMode="cover" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Top Header Label */}
      <View style={styles.headerLabelContainer}>
        <Text style={styles.headerLabel}>DASHBOARD</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.welcomeText}>Welcome</Text>

        <View style={styles.cardContainer}>
          <DashboardCard 
            title="Start New Estimation"
            subtext="Begin a new project estimation"
            image={require('../../assets/floor.jpg')} // Update with your building image
            onPress={() => {/* Navigate to scan */}}
          />

          <DashboardCard 
            title="View Previous Estimates"
            subtext="Access and manage your past estimations"
            image={require('../../assets/arch.jpg')} // Update with your blueprint image
            onPress={() => {/* Navigate to history */}}
          />

          <DashboardCard 
            title="Help / About"
            subtext="Learn more about the app and get support"
            image={require('../../assets/arch.jpg')} // Update with your engineer image
            onPress={() => {/* Navigate to help */}}
          />
        </View>
      </ScrollView>

      {/* Custom Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={24} color="#2563EB" />
          <Text style={[styles.navText, {color: '#2563EB'}]}>HOME</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="document-text" size={24} color="#64748b" />
          <Text style={styles.navText}>ESTIMATES</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
          <Ionicons name="settings" size={24} color="#64748b" />
          <Text style={styles.navText}>LOGOUT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9', // Light gray-blue background
  },
  headerLabelContainer: {
    paddingTop: 20,
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    letterSpacing: 2,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 120, // Space for bottom nav
  },
  welcomeText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#0F172A', // Dark navy
    marginBottom: 30,
  },
  cardContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    // Shadow for Android
    elevation: 5,
  },
  cardTextContent: {
    flex: 1,
    paddingRight: 15,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  cardSubtext: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  cardImage: {
    width: 100,
    height: 100,
    borderRadius: 15,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 30,
    left: 25,
    right: 25,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    color: '#64748B',
  }
});