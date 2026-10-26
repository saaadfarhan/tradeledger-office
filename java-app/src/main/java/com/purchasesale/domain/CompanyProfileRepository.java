package com.purchasesale.domain;

public interface CompanyProfileRepository {
    CompanyProfile load();
    void save(CompanyProfile profile);
}
