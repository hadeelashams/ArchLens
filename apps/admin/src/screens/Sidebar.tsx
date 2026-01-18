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
    width: 280, 
    backgroundColor: BLUE_ARCH, 
    paddingVertical: 40, 
    paddingHorizontal: 24, 
    justifyContent: 'space-between',
    height: '100%' 
  },
  logoArea: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  logoCircle: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.2)' 
  },
  brandTextWrapper: { flexDirection: 'row', alignItems: 'baseline' },
  archTypography: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  lensTypography: { fontSize: 18, fontWeight: '300', color: '#bae6fd', letterSpacing: 2, marginLeft: 3 },
  logoSub: { color: '#94a3b8', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  sidebarDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 30 },
  
  // Unified Navigation Styles
  navItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10, gap: 12 },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  navText: { fontWeight: '600', fontSize: 14 },
  
  logoutBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12 },
  logoutText: { color: '#fca5a5', marginLeft: 10, fontWeight: '700' },
});