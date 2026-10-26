package com.purchasesale.sqlite;

import com.purchasesale.domain.Account;
import com.purchasesale.domain.Challan;
import com.purchasesale.domain.InventoryService;
import com.purchasesale.domain.Item;
import com.purchasesale.domain.JournalVoucher;
import com.purchasesale.domain.PostedVoucher;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.LinkedHashSet;

public final class SQLitePersistenceTest {
    public static void main(String[] args) throws Exception {
        Path file = Paths.get("build", "sqlite-persistence-smoke.sqlite");
        Files.deleteIfExists(file);
        SQLiteOfficeData first = SQLiteOfficeData.open(file);
        first.accounts().save(new Account("1", "Assets", null));
        first.banks().save(new com.purchasesale.domain.Bank("BANK-1", "Demo Bank", "001", BigDecimal.ZERO, "", ""));
        first.cheques().save(new com.purchasesale.domain.Cheque("CHQ-001", "BANK-1", "2026-10-17", "Supplier", money("50"), "PENDING"));
        first.items().save(new Item("WIRE-001", "Copper Wire", "MTR", money("125"), money("100"), "REG"));
        InventoryService inventory = new InventoryService(first.items(), first.stockMovements());
        inventory.openingBalance("WIRE-001", "Main", money("10"), money("100"));
        Challan purchase = new Challan(Challan.Type.PURCHASE, "P-001", "2026-10-17", "Supplier", "Main", Arrays.asList(new Challan.Line("WIRE-001", money("2"), money("100"))));
        inventory.post(purchase); first.challans().save(purchase);
        JournalVoucher journal = new JournalVoucher(); journal.add("1", money("100"), BigDecimal.ZERO); journal.add("1", BigDecimal.ZERO, money("100"));
        first.vouchers().save(new PostedVoucher("V-001", "2026-10-17", "Smoke test", "", journal));
        LinkedHashSet<String> permissions = new LinkedHashSet<String>();
        permissions.add("Items");
        first.users().save(new com.purchasesale.domain.UserAccount("operator", "hash", permissions));
        first.close();

        SQLiteOfficeData second = SQLiteOfficeData.open(file);
        check(second.accounts().findAll().size() == 1, "account did not survive restart");
        check(second.items().findByCode("WIRE-001") != null, "item did not survive restart");
        check(second.challans().findAll().size() == 1, "challan did not survive restart");
        check(second.vouchers().findAll().size() == 1, "voucher did not survive restart");
        check(second.users().findAll().size() == 1, "user did not survive restart");
        check(second.cheques().findAll().size() == 1, "cheque did not survive restart");
        check(second.cheques().history("CHQ-001").size() == 1, "cheque history did not survive restart");
        InventoryService reopenedInventory = new InventoryService(second.items(), second.stockMovements());
        check(reopenedInventory.stock("WIRE-001", "Main").compareTo(money("12")) == 0, "stock did not survive restart");
        Path backup = Paths.get("build", "sqlite-backup-smoke.sqlite");
        Files.deleteIfExists(backup);
        second.backupTo(backup);
        check(Files.size(backup) > 0, "backup was not created");
        second.close();
        Files.deleteIfExists(backup);
        Files.deleteIfExists(file);
        System.out.println("SQLitePersistenceTest: PASS");
    }

    private static BigDecimal money(String value) { return new BigDecimal(value); }
    private static void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
}
