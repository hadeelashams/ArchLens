import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '@archlens/shared';
import { collection, query, where, onSnapshot, deleteDoc, doc, getDocs, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

// Enable LayoutAnimation on Android (suppress warning for New Architecture)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch (e) {
    // Ignore warning in New Architecture
  }
}

export default function EstimateResultScreen({ route, navigation }: any) {
  const { projectId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId || null);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any>({});
  const [viewMode, setViewMode] = useState<'list' | 'breakdown'>('list'); // 'list' or 'breakdown'

  // Category icons mapping
  const categoryIcons: any = {
    'Foundation': 'home',
    'Wall': 'view-grid-plus',
    'Roofing': 'home-roof',
    'Flooring': 'view-module',
    'Painting': 'format-paint',
    'Plastering': 'texture',
  };

  useEffect(() => {
    if (!auth.currentUser) {
      setError('Please log in to view estimates.');
      setLoading(false);
      return;
    }

    let unsubscribeProjects: (() => void) | undefined;
    let unsubscribeEstimates: (() => void) | undefined;

    // 1. Fetch Projects List
    const qProjects = query(
      collection(db, 'projects'),
      where('userId', '==', auth.currentUser.uid)
      // Removed orderBy('createdAt', 'desc') to avoid missing index error. 
      // We sort client-side in the snapshot listener instead.
    );

    unsubscribeProjects = onSnapshot(qProjects, (snap) => {
      const projData = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Sort client-side: descending by createdAt
      projData.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setProjects(projData);

      // If we have an activeProjectId, find and set the activeProject object
      if (activeProjectId) {
        const found = projData.find(p => p.id === activeProjectId);
        if (found) setActiveProject(found);
      }

      if (!activeProjectId) {
        setViewMode('list');
        setLoading(false);
      }
    });

    // 2. Fetch Estimates if activeProjectId exists
    if (activeProjectId) {
      setViewMode('breakdown');
      setLoading(true);
      const qEst = query(
        collection(db, 'estimates'),
        where('projectId', '==', activeProjectId)
      );

      unsubscribeEstimates = onSnapshot(qEst, (snap) => {
        const estData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEstimates(estData);

        let total = 0;
        const breakdown: any = {};

        estData.forEach((item: any) => {
          const cost = item.totalCost || 0;
          total += cost;
          const category = item.category || 'Other';
          if (!breakdown[category]) {
            breakdown[category] = { total: 0, items: 0, color: getCategoryColor(category) };
          }
          breakdown[category].total += cost;
          breakdown[category].items += 1;
        });

        setGrandTotal(total);
        setCategoryBreakdown(breakdown);
        setLoading(false);

        // Sync total to parent project document for HomeScreen visibility
        if (activeProjectId) {
          const projectRef = doc(db, 'projects', activeProjectId);
          updateDoc(projectRef, {
            totalEstimate: total,
            updatedAt: serverTimestamp()
          }).catch(err => console.error("Error syncing project total:", err));
        }
      }, (err) => {
        console.error("Est fetch error:", err);
        setError("Failed to load estimates.");
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribeProjects) unsubscribeProjects();
      if (unsubscribeEstimates) unsubscribeEstimates();
    };
  }, [activeProjectId]);

  const getCategoryColor = (category: string) => {
    const colors: any = {
      'Foundation': ['#4F46E5', '#818cf8'],
      'Wall': ['#3b82f6', '#60a5fa'],
      'Roofing': ['#0ea5e9', '#38bdf8'],
      'Flooring': ['#14b8a6', '#2dd4bf'],
      'Painting': ['#10b981', '#34d399'],
      'Plastering': ['#64748B', '#94a3b8'],
    };
    return colors[category] || ['#6b7280', '#9ca3af'];
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Remove Item", "Are you sure you want to remove this estimate?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, 'estimates', id)) }
    ]);
  };

  const handleDeleteProject = async (id: string, name: string) => {
    Alert.alert(
      "Delete Project",
      `Are you sure you want to delete "${name}"? This will permanently remove the project and its estimates.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Fetch and delete associated estimates
              const q = query(collection(db, 'estimates'), where('projectId', '==', id));
              const snap = await getDocs(q);
              const deletes = snap.docs.map(d => deleteDoc(d.ref));
              await Promise.all(deletes);

              // 2. Delete project doc
              await deleteDoc(doc(db, 'projects', id));
            } catch (err) {
              console.error("Delete project error:", err);
              Alert.alert("Error", "Failed to delete project.");
            }
          }
        }
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };


  const handlePDFExport = async () => {
    if (!activeProject || estimates.length === 0) {
      Alert.alert("PDF Export", "No data available to generate PDF.");
      return;
    }

    try {
      const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background-color: #fff; }
            .header { border-bottom: 3px solid #315b76; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .brand { color: #315b76; font-size: 32px; font-weight: 800; }
            .project-title { font-size: 24px; font-weight: 700; color: #1e293b; margin-top: 10px; }
            .meta-row { display: flex; justify-content: space-between; margin-top: 15px; font-size: 14px; color: #64748b; }
            .summary-box { background-color: #f8fafc; border-radius: 16px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
            .grand-total { font-size: 36px; font-weight: 800; color: #10b981; margin-top: 5px; }
            .section-label { font-size: 12px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 15px; }
            .category-card { margin-bottom: 25px; border: 1px solid #f1f5f9; border-radius: 12px; overflow: hidden; }
            .category-header { background-color: #f1f5f9; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; font-size: 11px; color: #94a3b8; padding: 10px 20px; border-bottom: 1px solid #f1f5f9; }
            td { padding: 12px 20px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
            .item-name { font-weight: 600; color: #334155; }
            .item-qty { color: #64748b; }
            .item-price { font-weight: 700; color: #1e293b; text-align: right; }
            .plan-img { width: 100%; border-radius: 16px; margin-bottom: 30px; border: 1px solid #e2e8f0; max-height: 400px; object-fit: contain; background-color: #f8fafc; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">ARCHLENS</div>
              <div class="project-title">${activeProject.name || 'Untitled Project'}</div>
            </div>
            <div style="text-align: right; font-size: 14px; color: #94a3b8;">
              Estimated: ${new Date().toLocaleDateString()}
            </div>
          </div>

          <div class="summary-box">
            <div class="section-label">ESTIMATED GRAND TOTAL</div>
            <div class="grand-total">₹${formatCurrency(grandTotal)}</div>
            <div class="meta-row">
              <div>Plan Area: <b>${activeProject.totalArea || 0} sq.ft</b></div>
              <div>Budget Tier: <b>${activeProject.tier || 'Standard'}</b></div>
            </div>
          </div>

          ${activeProject.planImageBase64 ? `
          <div class="section-label">FLOOR PLAN LAYOUT</div>
          <img src="${activeProject.planImageBase64}" class="plan-img" />
          ` : ''}

          <div class="section-label">MATERIAL BREAKDOWN</div>
          ${Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => {
        const categoryEstimates = estimates.filter(e => e.category === category);
        return `
              <div class="category-card">
                <div class="category-header">
                  <span>${category}</span>
                  <span>₹${formatCurrency(Math.round(data.total))}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th style="width: 50%;">ITEM / MATERIAL</th>
                      <th style="width: 20%;">QUANTITY</th>
                      <th style="width: 30%; text-align: right;">COST</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${categoryEstimates.map(estimate =>
          (estimate.lineItems || []).map((line: any) => `
                        <tr>
                          <td>
                            <div class="item-name">${line.materialName || line.name || 'Material'}</div>
                            <div style="font-size: 10px; color: #94a3b8;">${line.roomName || estimate.itemName || ''}</div>
                          </td>
                          <td class="item-qty">${line.quantity || line.qty} ${line.unit || 'Nos'}</td>
                          <td class="item-price">₹${formatCurrency(Math.round(line.total))}</td>
                        </tr>
                      `).join('')
        ).join('')}
                  </tbody>
                </table>
              </div>
            `;
      }).join('')}

          <div class="footer">
            This estimation is generated by ArchLens AI. Prices are based on market averages and may vary by location.<br/>
            © 2026 ArchLens Technology. All rights reserved.
          </div>
        </body>
      </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error: any) {
      Alert.alert("PDF Error", error.message);
    }
  };

  // Category Card Component
  const CategoryCard = ({ category, data }: any) => {
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(!expanded);
    };

    const categoryEstimates = estimates.filter(e => e.category === category);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={toggleExpand}
      >
        {/* Main Row */}
        <View style={styles.cardMainRow}>
          <LinearGradient colors={data.color} style={styles.cardIconContainer}>
            <MaterialCommunityIcons name={categoryIcons[category] || "calculator-variant"} size={24} color="#fff" />
          </LinearGradient>

          <View style={styles.cardTextContent}>
            <Text style={styles.cardTitle}>{category}</Text>
            <Text style={styles.cardSubtext}>{data.items} item(s)</Text>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amountText}>₹{formatCurrency(Math.round(data.total))}</Text>
            <View style={styles.currencyRow}>
              <Text style={styles.currencyLabel}>{grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : '0'}%</Text>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={16}
                color="#94a3b8"
                style={{ marginLeft: 4 }}
              />
            </View>
          </View>
        </View>

        {/* Expanded Details */}
        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.cardDivider} />
            {categoryEstimates.map((item, idx) => (
              <View key={idx}>
                {/* Estimate Item Header */}
                <View style={styles.estimateItemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.itemName}</Text>
                    {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                {/* Budget Level & Type Badge */}
                <View style={styles.badgeRow}>
                  {item.tier && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>📊 {item.tier}</Text>
                    </View>
                  )}
                  {item.foundationType && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>🏗️ {item.foundationType}</Text>
                    </View>
                  )}
                </View>

                {/* Line Items Detail Table */}
                {item.lineItems && item.lineItems.length > 0 && (
                  <View style={styles.lineItemsContainer}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeading, { flex: 1.5 }]}>Material</Text>
                      <Text style={[styles.tableHeading, { flex: 1 }]}>Qty</Text>
                      <Text style={[styles.tableHeading, { flex: 1, textAlign: 'right' }]}>Cost</Text>
                    </View>
                    {item.lineItems.map((line: any, lineIdx: number) => (
                      <View key={lineIdx} style={styles.tableRow}>
                        <View style={{ flex: 1.5 }}>
                          <Text style={styles.lineItemName}>
                            {line.materialName || line.name || line.label || 'Unknown Material'}
                          </Text>
                          {line.type && (
                            <View style={styles.materialTypeRow}>
                              <MaterialCommunityIcons
                                name={line.type === 'door' ? 'door' : 'window-open-variant'}
                                size={12}
                                color="#6366f1"
                              />
                              <Text style={styles.lineItemDesc}>
                                {line.type === 'door' ? 'Door' : 'Window'}
                                {line.roomName ? ` • ${line.roomName}` : ''}
                              </Text>
                            </View>
                          )}
                          {!line.type && line.desc && (
                            <Text style={styles.lineItemDesc}>{line.desc}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lineItemQty}>
                            {line.quantity || line.qty} {line.unit || 'Nos'}
                          </Text>
                          {line.unitPrice && (
                            <Text style={styles.lineItemRate}>@ ₹{formatCurrency(line.unitPrice)}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={styles.lineItemPrice}>₹{formatCurrency(Math.round(line.total || 0))}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Specifications if available */}
                {item.specifications && (
                  <View style={styles.specsBox}>
                    <Text style={styles.specsLabel}>Specifications:</Text>
                    <Text style={styles.specsValue}>
                      {item.specifications.method && `Method: ${item.specifications.method} • `}
                      {item.specifications.depth && `Depth: ${item.specifications.depth}' • `}
                      {item.specifications.plinth && 'Includes Plinth'}
                    </Text>
                  </View>
                )}

                {/* Total Cost */}
                <View style={styles.itemTotalRow}>
                  <Text style={styles.estimateLabel}>Estimate Total:</Text>
                  <Text style={styles.estimateTotal}>₹{formatCurrency(Math.round(item.totalCost))}</Text>
                </View>

                {/* Divider between items */}
                {idx < categoryEstimates.length - 1 && (
                  <View style={styles.itemDivider} />
                )}
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#315b76" />
        <Text style={styles.loadingText}>Loading Project Summary...</Text>
        <Text style={styles.loadingSubText}>Gathering all estimates</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconButton}
            >
              <Ionicons name="arrow-back" size={20} color="#315b76" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Project Summary</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={60} color="#ef4444" />
            <Text style={styles.errorTitle}>Error Loading Summary</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
              }}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <SafeAreaView style={styles.safeArea}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (viewMode === 'breakdown') {
                setActiveProjectId(null);
                setActiveProject(null);
                setViewMode('list');
              } else {
                navigation.navigate('Home');
              }
            }}
            style={styles.iconButton}
          >
            <Ionicons name="arrow-back" size={20} color="#315b76" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{viewMode === 'list' ? 'Select Project' : (activeProject?.name || 'Project Summary')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {viewMode === 'list' ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>YOUR ARCHIVE PROJECTS</Text>
            </View>

            {projects.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <MaterialCommunityIcons name="folder-outline" size={60} color="#cbd5e1" />
                <Text style={styles.emptyStateText}>No Projects Found</Text>
                <Text style={styles.emptyStateSubtext}>Upload a floor plan to start a new project estimation.</Text>
                <TouchableOpacity
                  style={styles.addMoreButton}
                  onPress={() => navigation.navigate("UploadPlan")}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addMoreButtonText}>New Project</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardsContainer}>
                {projects.map((proj) => (
                  <View
                    key={proj.id}
                    style={styles.projectCard}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => setActiveProjectId(proj.id)}
                    >
                      <View style={styles.projectIconBox}>
                        <MaterialCommunityIcons name="office-building" size={24} color="#315b76" />
                      </View>
                      <View style={styles.projectInfo}>
                        <Text style={styles.projectName}>{proj.name || 'Untitled Project'}</Text>
                        <Text style={styles.projectMeta}>
                          {proj.createdAt?.toDate ? proj.createdAt.toDate().toLocaleDateString() : 'Recent'} • {proj.status || 'Active'}
                        </Text>
                        {proj.totalArea && <Text style={styles.projectArea}>{proj.totalArea} sq.ft</Text>}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ padding: 8, marginRight: 4 }}
                      onPress={() => handleDeleteProject(proj.id, proj.name)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setActiveProjectId(proj.id)}>
                      <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : estimates.length === 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.emptyStateContainer}>
              <MaterialCommunityIcons name="file-document-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyStateText}>No Estimates Yet</Text>
              <Text style={styles.emptyStateSubtext}>Add estimates from construction components to see the summary for this project.</Text>
              <TouchableOpacity
                style={styles.addMoreButton}
                onPress={() => navigation.navigate("ConstructionLevel", {
                  projectId: activeProjectId,
                  totalArea: activeProject?.totalArea || 0,
                  rooms: activeProject?.rooms || [],
                  wallComposition: activeProject?.wallComposition || null,
                  allTierRecommendations: activeProject?.allTierRecommendations || null
                })}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addMoreButtonText}>Add Estimate</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >

            {/* HERO SECTION */}
            <View style={styles.heroWrapper}>
              <LinearGradient
                colors={['#315b76', '#2a4179']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroContainer}
              >
                <View style={styles.heroHeader}>
                  <Text style={styles.heroLabel}>PROJECT TOTAL ESTIMATE</Text>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>{Object.keys(categoryBreakdown).length} CATEGORIES</Text>
                  </View>
                </View>

                <Text style={styles.heroAmount}>
                  ₹ {formatCurrency(grandTotal)}
                </Text>

                <Text style={styles.heroSubtitle}>
                  {estimates.length} estimates across {Object.keys(categoryBreakdown).length} categories
                </Text>

                <View style={styles.divider} />

                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total Items</Text>
                    <Text style={styles.statValue}>{estimates.length}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Categories</Text>
                    <Text style={styles.statValue}>{Object.keys(categoryBreakdown).length}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Plan Area</Text>
                    <Text style={styles.statValue}>{activeProject?.totalArea || 0} sq.ft</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* CATEGORY BREAKDOWN */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>CATEGORY BREAKDOWN</Text>
            </View>

            <View style={styles.cardsContainer}>
              {Object.entries(categoryBreakdown).map(([category, data]: [string, any]) => (
                <CategoryCard key={category} category={category} data={data} />
              ))}
            </View>

            {/* FOOTER ACTIONS */}
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.addMoreButton}
                onPress={() => navigation.navigate("ConstructionLevel", {
                  projectId: activeProjectId,
                  totalArea: activeProject?.totalArea || 0,
                  rooms: activeProject?.rooms || [],
                  wallComposition: activeProject?.wallComposition || null,
                  allTierRecommendations: activeProject?.allTierRecommendations || null
                })}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.addMoreButtonText}>Add More</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportButton}
                onPress={handlePDFExport}
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={20} color="#315b76" />
                <Text style={styles.exportButtonText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home" size={24} color="#64748b" />
            <Text style={styles.navText}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => { /* Already on Estimates */ }}>
            <Ionicons name="document-text" size={24} color="#315b76" />
            <Text style={[styles.navText, { color: '#315b76' }]}>ESTIMATES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={24} color="#64748b" />
            <Text style={styles.navText}>PROFILE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 20, fontSize: 18, fontWeight: '700', color: '#1e293b' },
  loadingSubText: { marginTop: 8, fontSize: 14, color: '#64748b' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 15,
  },
  iconButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#f1f5f9',
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b' },

  heroWrapper: { marginTop: 10, marginBottom: 25 },
  heroContainer: {
    borderRadius: 24, padding: 24,
    shadowColor: '#315b76', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  levelBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  levelText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 20 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 15 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'flex-start' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 2 },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '600' },

  sectionHeader: { marginBottom: 15 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },

  cardsContainer: { gap: 16 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 16,
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 2,
    borderWidth: 1, borderColor: '#f8fafc',
    overflow: 'hidden'
  },
  cardMainRow: { flexDirection: 'row', alignItems: 'center' },
  cardIconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  cardSubtext: { fontSize: 12, color: '#64748b' },
  amountContainer: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  currencyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  currencyLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },

  expandedContent: { marginTop: 16, paddingBottom: 12 },
  cardDivider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemName: { fontSize: 13, color: '#1e293b', fontWeight: '600' },
  itemNotes: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  itemCost: { fontSize: 13, fontWeight: '700', color: '#315b76' },

  // Enhanced Estimate Details
  estimateItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10 },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  badge: { backgroundColor: '#f0f4f8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#475569' },

  lineItemsContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginVertical: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: '#cbd5e1', marginBottom: 8 },
  tableHeading: { fontSize: 10, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  lineItemName: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  lineItemDesc: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  materialTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  lineItemQty: { fontSize: 12, color: '#475569', fontWeight: '500' },
  lineItemRate: { fontSize: 10, color: '#94a3b8', marginTop: 1 },
  lineItemPrice: { fontSize: 12, fontWeight: '700', color: '#10b981' },

  specsBox: { backgroundColor: '#eef2ff', padding: 10, borderRadius: 8, marginVertical: 10, borderLeftWidth: 3, borderLeftColor: '#6366f1' },
  specsLabel: { fontSize: 10, fontWeight: '700', color: '#4338ca', textTransform: 'uppercase' },
  specsValue: { fontSize: 11, color: '#4338ca', marginTop: 4, lineHeight: 16 },

  itemTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginTop: 10 },
  estimateLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  estimateTotal: { fontSize: 14, fontWeight: '800', color: '#315b76' },

  itemDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },

  emptyStateContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 60, paddingHorizontal: 24
  },
  emptyStateText: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16 },
  emptyStateSubtext: { fontSize: 13, color: '#64748b', marginTop: 8, textAlign: 'center', lineHeight: 19 },

  footerActions: {
    flexDirection: 'row', gap: 12, marginTop: 25
  },
  addMoreButton: {
    flex: 1, backgroundColor: '#315b76', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    shadowColor: '#315b76', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  addMoreButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  exportButton: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  exportButtonText: { fontSize: 15, fontWeight: '700', color: '#315b76' },

  // Error State Styles
  errorContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 60, paddingHorizontal: 24
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#ef4444', marginTop: 16, marginBottom: 8 },
  errorText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryButton: {
    backgroundColor: '#315b76', borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12
  },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // BOTTOM NAVIGATION BAR
  bottomNavContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 30 : 20 },
  bottomNav: { width: width * 0.9, height: 70, backgroundColor: '#FFFFFF', borderRadius: 35, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', elevation: 20, shadowColor: '#315b76', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 },
  navItem: { alignItems: 'center', height: '100%', justifyContent: 'center', flex: 1 },
  navText: { fontSize: 10, fontWeight: 'bold', marginTop: 4, color: '#64748b' },

  // Project Card Styles
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  projectIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  projectMeta: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  projectArea: {
    fontSize: 11,
    color: '#315b76',
    marginTop: 4,
    fontWeight: '600',
  },
});