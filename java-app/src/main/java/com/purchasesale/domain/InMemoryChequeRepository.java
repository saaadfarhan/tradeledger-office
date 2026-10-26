package com.purchasesale.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Date;
import java.text.SimpleDateFormat;

public final class InMemoryChequeRepository implements ChequeRepository {
    private final List<Cheque> cheques = new ArrayList<Cheque>();
    private final List<ChequeStatusChange> changes = new ArrayList<ChequeStatusChange>();
    @Override public List<Cheque> findAll() { return new ArrayList<Cheque>(cheques); }
    @Override public void save(Cheque cheque) { for (int i = 0; i < cheques.size(); i++) if (cheques.get(i).getNumber().equals(cheque.getNumber())) { cheques.set(i, cheque); changes.add(new ChequeStatusChange(cheque.getNumber(), cheque.getStatus(), now())); return; } cheques.add(cheque); changes.add(new ChequeStatusChange(cheque.getNumber(), cheque.getStatus(), now())); }
    @Override public List<ChequeStatusChange> history(String chequeNumber) { List<ChequeStatusChange> result = new ArrayList<ChequeStatusChange>(); for (ChequeStatusChange change : changes) if (change.getChequeNumber().equals(chequeNumber)) result.add(change); return result; }
    private String now() { return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()); }
}
