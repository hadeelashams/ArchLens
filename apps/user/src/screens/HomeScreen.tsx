import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, 
  Dimensions, SafeAreaView, Platform, ImageBackground, Modal, Alert 
} from 'react-native';
import { auth } from '@archlens/shared';
import { signOut } from 'firebase/auth';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Added MaterialCommunityIcons for better construction icons
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }: any) {
  const [userName, setUserName] = useState('User');
  const [menuVisible, setMenuVisible] = useState(false); 

  useEffect(() => {
    const user = auth?.currentUser;
    if (user) {
      const name = user.displayName || user.email?.split('@')[0] || 'User';
      setUserName(name);
    }
  }, []);
  
  const handleLogout = async () => {
    setMenuVisible(false);
    try {
      if(auth) await signOut(auth);
    } catch (error: any) {
      Alert.alert("Logout Failed", error.message);
    }
  };

  // --- MODERNIZED CARD COMPONENT ---
  // Replaced "Image" with "Icon/Gradient" for a cleaner software look
  const DashboardCard = ({ title, subtext, iconName, gradientColors, onPress }: any) => (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Icon Container instead of Image */}
      <LinearGradient colors={gradientColors} style={styles.cardIconContainer}>
        <MaterialCommunityIcons name={iconName} size={24} color="#fff" />
      </LinearGradient>

      <View style={styles.cardTextContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtext} numberOfLines={2}>{subtext}</Text>
      </View>

      {/* Chevron for better UX */}
      <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* NAV BAR */}
        <View style={styles.navBar}>
          <View style={styles.logoContainer}>
            {/* Logo Brand */}
            <View style={styles.brandTextWrapper}>
              <Text style={styles.archTypography}>ARCH</Text>
              <Text style={styles.lensTypography}>LENS</Text>
              <View style={styles.activeDot} /> 
            </View>
          </View>
          
          <View style={styles.rightIcons}>
            {/* Modern Circular Buttons */}
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="search" size={20} color="#315b76" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={[styles.iconButton, { marginLeft: 12 }]}>
                <Ionicons name="grid-outline" size={20} color="#315b76" />
            </TouchableOpacity>
          </View>
        </View>

        {/* LOGOUT MENU MODAL */}
        <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setMenuVisible(false)}
          >
            <View style={styles.menuDropdown}>
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <View style={styles.menuIconBg}>
                    <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                </View>
                <Text style={styles.menuItemText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <ScrollView 
            bounces={true} 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingBottom: 130 }}
        >
          
          {/* --- HERO SECTION (MAGAZINE STYLE) --- */}
          <View style={styles.heroWrapper}>
            <TouchableOpacity activeOpacity={0.9} style={styles.heroContainer}>
                <ImageBackground 
                    source={require('../../assets/dash.jpg')} 
                    style={styles.heroBackground}
                    imageStyle={{ borderRadius: 24 }}
                >
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.heroGradient}
                    >
                        {/* Glassmorphism Badge */}
                        <View style={styles.heroGlassContent}>
                            <View style={styles.badgeRow}>
                                <View style={styles.liveBadge}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.liveText}>NEW TOOL</Text>
                                </View>
                            </View>
                            <Text style={styles.heroTitle}>Smart Cost Calculator</Text>
                            <Text style={styles.heroSubtitle}>Generate accurate construction estimates in seconds.</Text>
                            
                            {/* Call To Action Button inside Hero */}
                            <View style={styles.heroButton}>
                                <Text style={styles.heroButtonText}>Try Now</Text>
                                <Ionicons name="arrow-forward" size={14} color="#0f172a" />
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </TouchableOpacity>
          </View>

          <View style={styles.mainContent}>
            <View style={styles.welcomeRow}>
              <View>
                <Text style={styles.greeting}>Welcome Back,</Text>
                <Text style={styles.userNameHeader}>{userName}</Text>
              </View>
              {/* Profile Avatar Placeholder */}
              <View style={styles.avatarCircle}>
                 <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              <View style={styles.sectionHeader}>
                 <Text style={styles.sectionLabel}>WORKSPACE</Text>
                 <TouchableOpacity><Text style={styles.seeAllText}>See All</Text></TouchableOpacity>
              </View>

              <DashboardCard 
                title="New Estimation"
                subtext="Calculate costs from floor plans"
                iconName="calculator-variant"
                gradientColors={['#315b76', '#4a7c9b']} // Brand Blue
                onPress={() => navigation.navigate('UploadPlan')}
              />
              
              <DashboardCard 
                title="Project History"
                subtext="Review your past 12 estimates"
                iconName="file-document-outline"
                gradientColors={['#2a4179', '#43589a']} // Amber/Orange
                onPress={() => {}}
              />

              <DashboardCard 
                title="Material Rates"
                subtext="Live cement & steel prices"
                iconName="chart-line"
                gradientColors={['#deb543', '#cca145']} // Emerald Green
                onPress={() => {}}
              />
            </View>
          </View>
        </ScrollView>

        {/* BOTTOM NAV (UNCHANGED AS REQUESTED) */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home" size={24} color="#315b76" />
            <Text style={[styles.navText, {color: '#315b76'}]}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="document-text-outline" size={24} color="#64748b" />
            <Text style={styles.navText}>ESTIMATES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={24} color="#64748b" />
            <Text style={styles.navText}>PROFILE</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, // Slate 50 - Cleaner than FAFAFA
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 35 : 0 },
  
  // NAV BAR
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 15 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  brandTextWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  archTypography: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  lensTypography: { fontSize: 22, fontWeight: '300', color: '#64748b', letterSpacing: -0.5 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginLeft: 4, marginBottom: 4 }, // Small red dot for accent
  rightIcons: { flexDirection: 'row', alignItems: 'center' },
  
  // New Circular Icon Buttons
  iconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
  },
  
  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.2)' },
  menuDropdown: { 
    position: 'absolute', top: 80, right: 24, 
    backgroundColor: '#fff', borderRadius: 16, padding: 8, 
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  menuIconBg: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' },
  menuItemText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },

  // HERO SECTION
  heroWrapper: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 10 },
  heroContainer: {
    shadowColor: '#315b76', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12,
  },
  heroBackground: { width: '100%', height: height * 0.32, overflow: 'hidden' },
  heroGradient: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  
  // "Glass" Effect inside Hero
  heroGlassContent: { },
  badgeRow: { flexDirection: 'row', marginBottom: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80', marginRight: 6 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', lineHeight: 34, marginBottom: 6 },
  heroSubtitle: { fontSize: 14, color: '#cbd5e1', marginBottom: 16, maxWidth: '90%' },
  heroButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 30, gap: 6 },
  heroButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },

  // MAIN CONTENT
  mainContent: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  greeting: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  userNameHeader: { fontSize: 22, color: '#0f172a', fontWeight: '700' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#475569' },
  
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  seeAllText: { fontSize: 12, fontWeight: '600', color: '#315b76' },
  
  cardContainer: { gap: 16 },
  
  // MODERN CARD STYLES
  card: { 
    backgroundColor: '#ffffff', 
    borderRadius: 20, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 2,
    borderWidth: 1, borderColor: '#f8fafc'
  },
  cardIconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  cardSubtext: { fontSize: 13, color: '#64748b' },

  // BOTTOM NAV (PRESERVED)
  bottomNav: { position: 'absolute', bottom: 25, left: 20, right: 20, height: 70, backgroundColor: '#FFFFFF', borderRadius: 35, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 10 },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 10, fontWeight: 'bold', marginTop: 4, color: '#64748b' }
});