package com.purchasesale.domain;

import java.util.List;

public interface ChequeRepository {
    List<Cheque> findAll();
    void save(Cheque cheque);
    List<ChequeStatusChange> history(String chequeNumber);
}
