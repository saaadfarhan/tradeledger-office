package com.purchasesale.domain;

public final class InMemoryCompanyProfileRepository implements CompanyProfileRepository {
    private CompanyProfile profile = new CompanyProfile("Purchase Sale Office", "", "", "", "");
    @Override public CompanyProfile load() { return profile; }
    @Override public void save(CompanyProfile profile) { this.profile = profile; }
}
