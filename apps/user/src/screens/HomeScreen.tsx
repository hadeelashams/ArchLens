import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, Platform, ImageBackground, Modal, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '@archlens/shared';
import { signOut } from 'firebase/auth';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
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

  // --- COMPONENT: MAIN LIST CARD ---
  const DashboardCard = ({ title, subtext, iconName, gradientColors, onPress }: any) => (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={gradientColors} style={styles.cardIconContainer}>
        <MaterialCommunityIcons name={iconName} size={26} color="#fff" />
      </LinearGradient>
      <View style={styles.cardTextContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtext} numberOfLines={2}>{subtext}</Text>
      </View>
      <View style={styles.chevronContainer}>
        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
      </View>
    </TouchableOpacity>
  );

  // --- COMPONENT: INSIGHT CARD ---
  const InsightCard = ({ title, tag, date, color }: any) => (
    <TouchableOpacity style={styles.insightCard} activeOpacity={0.8}>
        <View style={[styles.insightTag, { backgroundColor: color }]}>
            <Text style={styles.insightTagText}>{tag}</Text>
        </View>
        <Text style={styles.insightTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.insightFooter}>
            <Ionicons name="time-outline" size={12} color="#94a3b8" />
            <Text style={styles.insightDate}>{date}</Text>
        </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <SafeAreaView style={styles.safeArea}>
        
        {/* NAV BAR */}
        <View style={styles.navBar}>
          <View style={styles.logoContainer}>
            <View style={styles.brandTextWrapper}>
              <Text style={styles.archTypography}>ARCH</Text>
              <Text style={styles.lensTypography}>LENS</Text>
              <View style={styles.activeDot} /> 
            </View>
          </View>
          
          <View style={styles.rightIcons}>
            <TouchableOpacity style={styles.iconButton} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Ionicons name="search" size={20} color="#315b76" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={[styles.iconButton, { marginLeft: 12 }]} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="grid-outline" size={20} color="#315b76" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView bounces={true} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* HERO SECTION */}
          <View style={styles.heroWrapper}>
            <TouchableOpacity 
                activeOpacity={0.95} 
                style={styles.heroContainer}
                // ADDED: Navigation to UploadPlanScreen
                onPress={() => navigation.navigate('UploadPlan')} 
            >
                <ImageBackground 
                    source={require('../../assets/dash.jpg')} 
                    style={styles.heroBackground}
                    imageStyle={{ borderRadius: 24 }}
                    resizeMode="cover"
                >
                    <LinearGradient colors={['transparent', 'rgba(15, 23, 42, 0.85)']} style={styles.heroGradient}>
                        <View style={styles.heroGlassContent}>
                            <View style={styles.badgeRow}>
                                <View style={styles.liveBadge}>
                                    <View style={styles.liveDot} />
                                    <Text style={styles.liveText}>NEW TOOL</Text>
                                </View>
                            </View>
                            <Text style={styles.heroTitle}>Smart Cost Calculator</Text>
                            <Text style={styles.heroSubtitle}>Generate accurate construction estimates in seconds.</Text>
                            
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
            
            {/* WELCOME ROW */}
            <View style={styles.welcomeRow}>
              <Text style={styles.welcomeText} numberOfLines={1}>
                Welcome  <Text style={styles.userNameText}>{userName}</Text>
              </Text>
            </View>

            {/* --- WORKSPACE CARDS --- */}
            <View style={styles.cardContainer}>
              <View style={styles.sectionHeader}>
                 <Text style={styles.sectionLabel}>WORKSPACE</Text>
                 <TouchableOpacity hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                    <Text style={styles.seeAllText}>See All</Text>
                 </TouchableOpacity>
              </View>

              <DashboardCard 
                title="New Estimation"
                subtext="Calculate costs from floor plans"
                iconName="calculator-variant"
                gradientColors={['#315b76', '#4a7c9b']}
                onPress={() => navigation.navigate('UploadPlan')}
              />
              
              <DashboardCard 
                title="Project History"
                subtext="Review your past 12 estimates"
                iconName="file-document-outline"
                gradientColors={['#2a4179', '#43589a']}
                onPress={() => {}}
              />

              <DashboardCard 
                title="Material Rates"
                subtext="Live cement & steel prices"
                iconName="chart-line"
                gradientColors={['#ea580c', '#c2410c']}
                onPress={() => {}}
              />
            </View>

            {/* --- MARKET INSIGHTS --- */}
            <View style={styles.insightSection}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionLabel}>MARKET INSIGHTS</Text>
                    <Ionicons name="trending-up" size={16} color="#94a3b8" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 10 }}>
                    <InsightCard title="Steel prices drop by 5% in local markets" tag="Market" date="2h ago" color="#3b82f6" />
                    <InsightCard title="Best practices for monsoon concreting" tag="Tips" date="1d ago" color="#10b981" />
                    <InsightCard title="New Labor laws affecting construction" tag="Legal" date="3d ago" color="#f59e0b" />
                </ScrollView>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>

      {/* BOTTOM NAV */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
                <Ionicons name="home" size={24} color="#315b76" />
                <Text style={[styles.navText, {color: '#315b76'}]}>HOME</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('EstimateResult')}>
                <Ionicons name="document-text-outline" size={24} color="#64748b" />
                <Text style={styles.navText}>ESTIMATES</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="person-outline" size={24} color="#64748b" />
                <Text style={styles.navText}>PROFILE</Text>
            </TouchableOpacity>
        </View>
      </View>

      {/* LOGOUT MODAL */}
      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <SafeAreaView style={{flex:1}}>
            <View style={styles.menuDropdown}>
                <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <View style={styles.menuIconBg}>
                    <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                </View>
                <Text style={styles.menuItemText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  scrollContent: { paddingBottom: 130 },

  // NAV BAR
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 15 },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  brandTextWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  archTypography: { fontSize: 22, fontWeight: '800', color: '#335c77', letterSpacing: -0.5 },
  lensTypography: { fontSize: 22, fontWeight: '300', color: '#64748b', letterSpacing: -0.5 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginLeft: 4, marginBottom: 4 },
  rightIcons: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  
  // HERO SECTION
  heroWrapper: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 10 },
  heroContainer: { backgroundColor: '#fff', borderRadius: 24, shadowColor: '#315b76', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 8 },
  heroBackground: { width: '100%', height: height * 0.26, overflow: 'hidden', borderRadius: 24 },
  heroGradient: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  heroGlassContent: { },
  badgeRow: { flexDirection: 'row', marginBottom: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80', marginRight: 6 },
  liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', lineHeight: 32, marginBottom: 6 },
  heroSubtitle: { fontSize: 13, color: '#cbd5e1', marginBottom: 16, maxWidth: '90%', lineHeight: 18 },
  heroButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 30, gap: 6 },
  heroButtonText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },

  // MAIN CONTENT
  mainContent: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  
  // WELCOME ROW
  welcomeRow: { marginBottom: 25 },
  welcomeText: { fontSize: 20, color: '#64748b', fontWeight: '400' },
  userNameText: { color: '#0f172a', fontWeight: '700' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  seeAllText: { fontSize: 12, fontWeight: '600', color: '#315b76' },
  cardContainer: { gap: 12 },
  
  // CARD STYLES
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#94a3b8', shadowOffset: { width: 0,height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 1, borderWidth: 1, borderColor: '#f1f5f9' },
  cardIconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 3 },
  cardSubtext: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  chevronContainer: { marginLeft: 8 },

  // --- INSIGHTS SECTION ---
  insightSection: { marginTop: 35 },
  insightCard: { width: 150, height: 160, backgroundColor: '#fff', padding: 12, borderRadius: 16, marginRight: 12, borderWidth: 1, borderColor: '#f1f5f9', justifyContent: 'space-between' },
  insightTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  insightTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  insightTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', lineHeight: 20 },
  insightFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  insightDate: { fontSize: 11, color: '#94a3b8' },

  // BOTTOM NAV
  bottomNavContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 30 : 20 },
  bottomNav: { width: width * 0.9, height: 70, backgroundColor: '#FFFFFF', borderRadius: 35, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 20, shadowColor: '#315b76', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 },
  navItem: { alignItems: 'center', height: '100%', justifyContent: 'center', flex: 1 },
  navText: { fontSize: 10, fontWeight: 'bold', marginTop: 4, color: '#64748b' },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.25)' },
  menuDropdown: { position: 'absolute', top: 60, right: 24, backgroundColor: '#fff', borderRadius: 16, padding: 8, elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, minWidth: 150 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  menuIconBg: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' },
  menuItemText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
});