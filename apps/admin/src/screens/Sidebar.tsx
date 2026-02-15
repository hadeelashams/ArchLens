import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { auth } from '@archlens/shared';

const BLUE_ARCH = '#1e293b';

// 1. Updated Interface to include 'Users'
interface SidebarProps {
  navigation: any;
  activeRoute: 'AdminHome' | 'Dashboard' | 'Users';
}

export const Sidebar = ({ navigation, activeRoute }: SidebarProps) => {
  return (
    <View style={styles.sidebar}>
      <View>
        {/* LOGO SECTION */}
        <View style={styles.logoArea}>
          <LinearGradient 
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)']} 
            style={styles.logoCircle}
          >
            <Ionicons name="aperture" size={28} color="#ffffff" />
          </LinearGradient>
          <View>
            <View style={styles.brandTextWrapper}>
              <Text style={styles.archTypography}>ARCH</Text>
              <Text style={styles.lensTypography}>LENS</Text>
            </View>
            <Text style={styles.logoSub}>ADMIN CONSOLE</Text>
          </View>
        </View>

        <View style={styles.sidebarDivider} />

        {/* NAV ITEMS */}
        
        {/* 1. Home Overview */}
        <TouchableOpacity 
          style={[styles.navItem, activeRoute === 'AdminHome' && styles.navItemActive]} 
          onPress={() => navigation.navigate('AdminHome')}
        >
          <Feather name="home" size={20} color={activeRoute === 'AdminHome' ? "#fff" : "#94a3b8"} />
          <Text style={[styles.navText, { color: activeRoute === 'AdminHome' ? "#fff" : "#94a3b8" }]}>
            Home Overview
          </Text>
        </TouchableOpacity>

        {/* 2. Material Master */}
        <TouchableOpacity 
          style={[styles.navItem, activeRoute === 'Dashboard' && styles.navItemActive]} 
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Feather name="database" size={20} color={activeRoute === 'Dashboard' ? "#fff" : "#94a3b8"} />
          <Text style={[styles.navText, { color: activeRoute === 'Dashboard' ? "#fff" : "#94a3b8" }]}>
            Material Master
          </Text>
        </TouchableOpacity>

        {/* 3. User Management (Fixed Style & Placement) */}
        <TouchableOpacity 
          style={[styles.navItem, activeRoute === 'Users' && styles.navItemActive]} 
          onPress={() => navigation.navigate('Users')}
        >
          <Feather name="users" size={20} color={activeRoute === 'Users' ? "#fff" : "#94a3b8"} />
          <Text style={[styles.navText, { color: activeRoute === 'Users' ? "#fff" : "#94a3b8" }]}>
            Registered Users
          </Text>
        </TouchableOpacity>

      </View>

      {/* LOGOUT */}
      <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut(auth)}>
        <MaterialIcons name="logout" size={20} color="#fca5a5" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: { 
    width: 220, 
    backgroundColor: BLUE_ARCH, 
    paddingVertical: 32, 
    paddingHorizontal: 18, 
    justifyContent: 'space-between',
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)'
  },
  logoArea: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  logoCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.15)' 
  },
  brandTextWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  archTypography: { fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 1.8 },
  lensTypography: { fontSize: 15, fontWeight: '300', color: '#bae6fd', letterSpacing: 1.8, marginLeft: 2 },
  logoSub: { color: '#94a3b8', fontSize: 9, letterSpacing: 1.2, fontWeight: '700', marginTop: 2 },
  sidebarDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 24 },
  
  // Unified Navigation Styles
  navItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, gap: 10 },
  navItemActive: { backgroundColor: 'rgba(14, 165, 233, 0.15)', borderLeftWidth: 3, borderLeftColor: '#0ea5e9' },
  navText: { fontWeight: '600', fontSize: 13, flex: 1 },
  
  logoutBtn: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 10 },
  logoutText: { color: '#fca5a5', marginLeft: 8, fontWeight: '700', fontSize: 13 },
});