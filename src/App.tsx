return (
  <Layout
    language={language}
    setLanguage={setLanguage}
    courts={COURTS}
    translations={TRANSLATIONS}
  >
    {/* Основной UI */}
    <AdminDashboard />
    <Calendar />
    {COURTS.map(court => <CourtCard key={court.id} court={court} />)}
    <SubscriptionPanel />
    <TimeGrid />
  </Layout>
);
