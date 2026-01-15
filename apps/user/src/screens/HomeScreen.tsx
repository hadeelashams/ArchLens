import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Dimensions, 
  SafeAreaView,
  Platform,
  ImageBackground 
} from 'react-native';
import { auth } from '@archlens/shared';
import { signOut } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const name = user.displayName || user.email?.split('@')[0] || 'User';
      setUserName(name);
    }
  }, []);
  
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
    <View style={styles.container}>
      <StatusBar style="dark" />
      {/* 1. SafeAreaView wraps the whole screen to handle notches */}
      <SafeAreaView style={styles.safeArea}>
        
        {/* CORRECTED NAV BAR */}
        <View style={styles.navBar}>
          <Text style={styles.brandTitle}>ARCH LENS</Text>
          
          <View style={styles.rightIcons}>
            <TouchableOpacity style={styles.navIconButton}>
              <Ionicons name="search-outline" size={26} color="#315b76" />
            </TouchableOpacity>
            
            {/* Using Menu icon to match the image style, or keep Profile */}
            <TouchableOpacity onPress={() => {/* Profile or Menu logic */}}>
                <Ionicons name="menu-outline" size={30} color="#315b76" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          
          {/* HERO SECTION - Now touches the Nav Bar perfectly */}
          <ImageBackground 
            source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }} 
            style={styles.heroBackground}
          >
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>House Construction Cost Calculator</Text>
              <Text style={styles.heroSubtitle}>The ultimate construction budgeting tool</Text>
            </View>
          </ImageBackground>

          {/* OVERLAPPING CONTENT CARD */}
          <View style={styles.mainContentCard}>
            <View style={styles.welcomeRow}>
              <Text style={styles.sectionLabel}>Dashboard*</Text>
              <Text style={styles.userNameHeader}>Welcome back, {userName}</Text>
            </View>

            <View style={styles.cardContainer}>
              <DashboardCard 
                title="Start New Estimation"
                subtext="Begin calculating costs for your new project"
                image={require('../../assets/floor.jpg')} 
                onPress={() => {/* Navigate scan */}}
              />
              <DashboardCard 
                title="View Previous Estimates"
                subtext="Access your project history and reports"
                image={require('../../assets/arch.jpg')} 
                onPress={() => {/* Navigate history */}}
              />
              <DashboardCard 
                title="Help & Support"
                subtext="Get assistance and find FAQs"
                image={require('../../assets/arch.jpg')} 
                onPress={() => {/* Navigate history */}}
              />
            </View>
          </View>
        </ScrollView>

        {/* BOTTOM NAV */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="home" size={24} color="#315b76" />
            <Text style={[styles.navText, {color: '#315b76'}]}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="document-text" size={24} color="#64748b" />
            <Text style={styles.navText}>ESTIMATES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#64748b" />
            <Text style={styles.navText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    // On Android, SafeAreaView sometimes needs a slight paddingTop for the status bar
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 60, // Standard header height
    backgroundColor: '#ffffff',
    // Removed marginBottom and excessive paddingTop
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#315b76',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navIconButton: {
    marginRight: 15,
  },
  heroBackground: {
    width: '100%',
    height: height * 0.35,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(49, 91, 118, 0.7)', 
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.9,
  },
  mainContentCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: -40, 
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 120,
  },
  welcomeRow: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#76a131', 
    marginBottom: 5,
  },
  userNameHeader: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  cardContainer: {
    gap: 15,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#315b76',
  },
  cardSubtext: {
    fontSize: 12,
    color: '#64748b',
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 25,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: 35,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
  },
  navText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  }
});