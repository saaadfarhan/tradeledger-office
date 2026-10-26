package com.purchasesale.ui;

import com.purchasesale.domain.Account;
import com.purchasesale.domain.AccountRepository;
import com.purchasesale.domain.Bank;
import com.purchasesale.domain.BankRepository;
import com.purchasesale.domain.Challan;
import com.purchasesale.domain.ChallanRepository;
import com.purchasesale.domain.CompanyProfile;
import com.purchasesale.domain.CompanyProfileRepository;
import com.purchasesale.domain.Cheque;
import com.purchasesale.domain.ChequeRepository;
import com.purchasesale.domain.InventoryService;
import com.purchasesale.domain.Item;
import com.purchasesale.domain.ItemRepository;
import com.purchasesale.domain.JournalVoucher;
import com.purchasesale.domain.PostedVoucher;
import com.purchasesale.domain.VoucherRepository;
import com.purchasesale.domain.StockMovementRepository;
import com.purchasesale.domain.InMemoryCompanyProfileRepository;
import com.purchasesale.domain.UserAccount;
import com.purchasesale.domain.UserAccountRepository;
import com.purchasesale.domain.InMemoryUserAccountRepository;
import com.purchasesale.domain.InMemoryChequeRepository;
import com.purchasesale.sqlite.SQLiteOfficeData;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.Icon;
import javax.swing.JLabel;
import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JPopupMenu;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JToolBar;
import javax.swing.JTextArea;
import javax.swing.JTextPane;
import javax.swing.JTextField;
import javax.swing.JPasswordField;
import javax.swing.JComponent;
import javax.swing.AbstractAction;
import javax.swing.KeyStroke;
import javax.swing.JTree;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.JTabbedPane;
import javax.swing.Timer;
import javax.swing.table.DefaultTableModel;
import javax.swing.DefaultCellEditor;
import javax.swing.tree.DefaultTreeModel;
import javax.swing.tree.DefaultMutableTreeNode;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.BasicStroke;
import java.awt.RenderingHints;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.GridLayout;
import java.awt.Insets;
import java.awt.event.KeyEvent;
import java.text.SimpleDateFormat;
import java.text.MessageFormat;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.Date;
import java.util.Calendar;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.Deque;
import java.nio.file.Paths;
import java.nio.file.Path;
import java.nio.file.Files;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.util.Base64;
import java.util.Set;
import java.util.LinkedHashSet;
import javax.swing.plaf.FontUIResource;
import javax.swing.filechooser.FileNameExtensionFilter;
import java.io.BufferedWriter;
import java.nio.charset.StandardCharsets;

public final class Main {
    private static final String HOME = "Home";
    private static final String[] USER_PERMISSIONS = {"Chart of Account", "Items", "Bank", "Cheque Detail", "Opening Balances", "Stock Types", "Voucher", "Journal Voucher", "Purchase Challan", "Sale Challan", "Search Payment", "Transfer", "Reports", "Backup", "User Rights"};
    private final CardLayout layout = new CardLayout();
    private final JPanel cards = new JPanel(layout);
    private final JLabel status = new JLabel("  Demo mode: data is held in memory");
    private final Map<String, JPanel> screens = new LinkedHashMap<String, JPanel>();
    private final AccountRepository accounts;
    private final BankRepository banks;
    private final ItemRepository items;
    private final ChallanRepository challans;
    private final VoucherRepository vouchers;
    private final AutoCloseable persistence;
    private final Path databasePath;
    private final CompanyProfileRepository companyProfile;
    private final UserAccountRepository users;
    private final ChequeRepository cheques;
    private final InventoryService inventory;
    private JComboBox<String> chequeBankSelector;
    private String currentScreen = HOME;
    private final Deque<String> backHistory = new ArrayDeque<String>();
    private final Deque<String> forwardHistory = new ArrayDeque<String>();
    private UserAccount activeUser;
    private final List<JComboBox<String>> itemSelectors = new ArrayList<JComboBox<String>>();
    private final List<JComboBox<String>> accountSelectors = new ArrayList<JComboBox<String>>();
    private final List<JComboBox<String>> partySelectors = new ArrayList<JComboBox<String>>();
    private final List<JComboBox<String>> locationSelectors = new ArrayList<JComboBox<String>>();
    private final Map<String, String> stockTypes = new LinkedHashMap<String, String>();
    private final List<JComboBox<String>> stockTypeSelectors = new ArrayList<JComboBox<String>>();
    private final List<String[]> auditEvents = new ArrayList<String[]>();

    private Main(AccountRepository accounts, BankRepository banks, ItemRepository items, ChallanRepository challans, VoucherRepository vouchers, StockMovementRepository stockMovements, CompanyProfileRepository companyProfile, UserAccountRepository users, ChequeRepository cheques, AutoCloseable persistence, Path databasePath) {
        this.accounts = accounts;
        this.banks = banks;
        this.items = items;
        this.challans = challans;
        this.vouchers = vouchers;
        this.persistence = persistence;
        this.databasePath = databasePath;
        this.companyProfile = companyProfile;
        this.users = users;
        this.cheques = cheques;
        this.inventory = new InventoryService(items, stockMovements);
        stockTypes.put("REG", "Regular");
        stockTypes.put("SER", "Service");
        if (persistence instanceof SQLiteOfficeData) {
            for (String[] row : ((SQLiteOfficeData) persistence).stockTypes()) stockTypes.put(row[0], row[1]);
        }
    }

    public static void main(String[] args) {
        configureLookAndFeel();
        SwingUtilities.invokeLater(new Runnable() {
            @Override public void run() {
                if (Boolean.getBoolean("purchase.sale.sqlite")) {
                    try {
                        String path = System.getProperty("purchase.sale.database", "data\\purchase-sale.sqlite");
                        SQLiteOfficeData data = SQLiteOfficeData.open(Paths.get(path));
                        new Main(data.accounts(), data.banks(), data.items(), data.challans(), data.vouchers(), data.stockMovements(), data.companyProfile(), data.users(), data.cheques(), data, Paths.get(path).toAbsolutePath()).open();
                    } catch (Exception error) {
                        error.printStackTrace();
                        JOptionPane.showMessageDialog(null, "SQLite startup failed:\n" + error.getMessage(), "Cannot start production database", JOptionPane.ERROR_MESSAGE);
                    }
                } else {
                    new Main(com.purchasesale.demo.OfficeData.accounts(), com.purchasesale.demo.OfficeData.banks(), com.purchasesale.demo.OfficeData.items(), com.purchasesale.demo.OfficeData.challans(), com.purchasesale.demo.OfficeData.vouchers(), com.purchasesale.demo.OfficeData.stockMovements(), new InMemoryCompanyProfileRepository(), new InMemoryUserAccountRepository(), new InMemoryChequeRepository(), null, null).open();
                }
            }
        });
    }

    private void open() {
        if (databasePath != null && !authenticateProductionUser()) return;
        JFrame frame = new JFrame("Purchase Sale Office - " + (databasePath == null ? "Demo mode" : "SQLite production"));
        installShortcuts(frame);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(1240, 760);
        frame.setMinimumSize(new Dimension(1050, 650));
        frame.setLocationByPlatform(true);
        registerScreens();
        frame.setJMenuBar(menuBar(frame));
        frame.add(toolbar(frame), BorderLayout.NORTH);
        frame.add(cards, BorderLayout.CENTER);
        status.setBorder(BorderFactory.createEmptyBorder(6, 8, 6, 8));
        frame.add(status, BorderLayout.SOUTH);
        showScreen(HOME);
        frame.setVisible(true);
    }

    private void installShortcuts(final JFrame frame) {
        JComponent root = frame.getRootPane();
        root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke(KeyEvent.VK_LEFT, KeyEvent.ALT_DOWN_MASK), "back");
        root.getActionMap().put("back", new AbstractAction() { @Override public void actionPerformed(java.awt.event.ActionEvent e) { goBack(); } });
        root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke(KeyEvent.VK_RIGHT, KeyEvent.ALT_DOWN_MASK), "forward");
        root.getActionMap().put("forward", new AbstractAction() { @Override public void actionPerformed(java.awt.event.ActionEvent e) { goForward(); } });
        root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke(KeyEvent.VK_H, KeyEvent.CTRL_DOWN_MASK), "home");
        root.getActionMap().put("home", new AbstractAction() { @Override public void actionPerformed(java.awt.event.ActionEvent e) { showScreen(HOME); } });
        root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke(KeyEvent.VK_B, KeyEvent.CTRL_DOWN_MASK), "backup");
        root.getActionMap().put("backup", new AbstractAction() { @Override public void actionPerformed(java.awt.event.ActionEvent e) { backup(frame); } });
    }

    private boolean authenticateProductionUser() {
        if (users.findAll().isEmpty()) {
            JPanel setup = new JPanel(new GridLayout(0, 1, 5, 5));
            JTextField username = new JTextField();
            JPasswordField password = new JPasswordField();
            setup.add(new JLabel("No users exist. Create the first administrator."));
            setup.add(new JLabel("Administrator user name")); setup.add(username);
            setup.add(new JLabel("Administrator password")); setup.add(password);
            int result = JOptionPane.showConfirmDialog(null, setup, "First-run administrator setup", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
            if (result != JOptionPane.OK_OPTION) return false;
            try {
                Set<String> permissions = new LinkedHashSet<String>();
                for (String permission : USER_PERMISSIONS) permissions.add(permission);
                activeUser = new UserAccount(username.getText(), passwordHash(new String(password.getPassword())), permissions);
                users.save(activeUser);
                return true;
            } catch (Exception error) {
                JOptionPane.showMessageDialog(null, "Administrator setup failed:\n" + error.getMessage(), "Cannot create administrator", JOptionPane.ERROR_MESSAGE);
                return false;
            }
        }

        for (int attempt = 1; attempt <= 3; attempt++) {
            JPanel login = new JPanel(new GridLayout(0, 1, 5, 5));
            JTextField username = new JTextField();
            JPasswordField password = new JPasswordField();
            login.add(new JLabel("User name")); login.add(username);
            login.add(new JLabel("Password")); login.add(password);
            int result = JOptionPane.showConfirmDialog(null, login, "Purchase Sale Office login", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
            if (result != JOptionPane.OK_OPTION) return false;
            String hash;
            String enteredPassword = new String(password.getPassword());
            for (UserAccount user : users.findAll()) {
                if (user.getUsername().equalsIgnoreCase(username.getText().trim()) && passwordMatches(enteredPassword, user.getPasswordHash())) {
                    activeUser = user;
                    if (!user.getPasswordHash().startsWith("pbkdf2$")) {
                        try { activeUser = new UserAccount(user.getUsername(), passwordHash(enteredPassword), user.getPermissions()); users.save(activeUser); }
                        catch (Exception ignored) { /* Legacy login remains valid if upgrade cannot be written. */ }
                    }
                    return true;
                }
            }
            JOptionPane.showMessageDialog(null, "Invalid user name or password. Attempt " + attempt + " of 3.", "Login failed", JOptionPane.WARNING_MESSAGE);
        }
        return false;
    }

    private void registerScreens() {
        add(HOME, home());
        add("Company Profile", companyProfileScreen());
        add("Chart of Account", chartOfAccounts());
        add("Items", itemScreen());
        add("Bank", bankScreen());
        add("Cheque Detail", chequeScreen());
        add("Item Opening Balances", openingBalancesScreen());
        add("Stock Types", stockTypesScreen());
        add("Voucher", voucherScreen("Voucher"));
        add("Journal Voucher", voucherScreen("Journal Voucher"));
        add("Purchase Challan", challanScreen("Purchase Challan"));
        add("Sale Challan", challanScreen("Sale Challan"));
        add("Search Payment", searchPaymentScreen());
        add("Payment / Receipt", paymentReceiptScreen());
        add("User Rights", userRightsScreen());
        add("Audit Log", auditScreen());
        add("Transfer", transferScreen());
        add("Transit", reportScreen("Transit"));
        add("Company Profitability Report", reportScreen("Company Profitability Report"));
        add("Item Profitability Report", reportScreen("Item Profitability Report"));
        add("Trial Balance", reportScreen("Trial Balance"));
        add("General Ledger", reportScreen("General Ledger"));
        add("Balance Sheet", reportScreen("Balance Sheet"));
        add("Profit & Loss", reportScreen("Profit & Loss"));
        add("Stock Ledger", reportScreen("Stock Ledger"));
        add("Stock Summary", reportScreen("Stock Summary"));
        add("Party Ledger", reportScreen("Party Ledger"));
        add("Purchase Register", reportScreen("Purchase Register"));
        add("Sales Register", reportScreen("Sales Register"));
        add("Receivables", reportScreen("Receivables"));
        add("Payables", reportScreen("Payables"));
        add("Cash Book", reportScreen("Cash Book"));
        add("Bank Book", reportScreen("Bank Book"));
        add("Ledger", reportScreen("Ledger"));
        add("Purchase Report Date Wise", reportScreen("Purchase Report Date Wise"));
        add("Trial Balance Date Wise", reportScreen("Trial Balance Date Wise"));
        add("Stock Report Date Wise", reportScreen("Stock Report Date Wise"));
        add("Stock Report Item Wise", reportScreen("Stock Report Item Wise"));
        add("Post Dated Cheques", reportScreen("Post Dated Cheques"));
        add("Returned Cheques", reportScreen("Returned Cheques"));
        add("Aging Report", reportScreen("Aging Report"));
        add("Receivable", reportScreen("Receivable"));
        add("Item Ledger", reportScreen("Item Ledger"));
        add("Party Item Detail", reportScreen("Party Item Detail"));
        add("PC Profit Report", reportScreen("PC Profit Report"));
        add("Type Wise Item Report", reportScreen("Type Wise Item Report"));
        add("OS Cheques", reportScreen("OS Cheques"));
        add("Party Activity Report", reportScreen("Party Activity Report"));
        add("Help", helpScreen());
    }

    private void add(String name, JPanel screen) {
        screens.put(name, screen);
        cards.add(screen, name);
    }

    private void replaceScreen(String name, JPanel replacement) {
        JPanel previous = screens.put(name, replacement);
        if (previous != null) cards.remove(previous);
        cards.add(replacement, name);
        cards.revalidate();
        cards.repaint();
    }

    private JMenuBar menuBar(JFrame frame) {
        JMenuBar bar = new JMenuBar();
        JMenu files = new JMenu("Files");
        JMenu masters = new JMenu("Masters");
        JMenu transactions = new JMenu("Transactions");
        JMenu reports = new JMenu("Reports");
        JMenu security = new JMenu("Security");
        JMenu window = new JMenu("Window");
        JMenuItem backup = new JMenuItem("Backup");
        backup.addActionListener(e -> backup(frame));
        JMenuItem exportData = new JMenuItem("Export Data");
        exportData.setEnabled(isAllowed("Backup"));
        exportData.addActionListener(e -> exportData(frame));
        JMenuItem verifyDatabase = new JMenuItem("Verify Database");
        verifyDatabase.setEnabled(isAllowed("Backup"));
        verifyDatabase.addActionListener(e -> verifyDatabase());
        JMenuItem company = new JMenuItem("Company Profile");
        company.addActionListener(e -> showScreen("Company Profile"));
        JMenuItem exit = new JMenuItem("Exit");
        exit.addActionListener(e -> frame.dispose());
        files.add(company); files.add(backup); files.add(exportData); files.add(verifyDatabase); files.addSeparator(); files.add(exit);
        addMenuItem(masters, "Chart of Account");
        addMenuItem(masters, "Items");
        addMenuItem(masters, "Bank");
        addMenuItem(masters, "Stock Types");
        addMenuItem(transactions, "Cheque Detail");
        addMenuItem(transactions, "Item Opening Balances");
        addMenuItem(transactions, "Voucher");
        addMenuItem(transactions, "Journal Voucher");
        addMenuItem(transactions, "Purchase Challan");
        addMenuItem(transactions, "Sale Challan");
        addMenuItem(transactions, "Search Payment");
        addMenuItem(transactions, "Payment / Receipt");
        addMenuItem(transactions, "Transfer");
        addMenuItem(reports, "Transit");
        addMenuItem(reports, "Company Profitability Report");
        addMenuItem(reports, "Item Profitability Report");
        reports.addSeparator();
        addMenuItem(reports, "Trial Balance");
        addMenuItem(reports, "General Ledger");
        addMenuItem(reports, "Balance Sheet");
        addMenuItem(reports, "Profit & Loss");
        addMenuItem(reports, "Stock Ledger");
        addMenuItem(reports, "Stock Summary");
        addMenuItem(reports, "Party Ledger");
        addMenuItem(reports, "Purchase Register");
        addMenuItem(reports, "Sales Register");
        addMenuItem(reports, "Receivables");
        addMenuItem(reports, "Payables");
        addMenuItem(reports, "Cash Book");
        addMenuItem(reports, "Bank Book");
        reports.addSeparator();
        addMenuItem(reports, "Ledger");
        addMenuItem(reports, "Purchase Report Date Wise");
        addMenuItem(reports, "Trial Balance Date Wise");
        addMenuItem(reports, "Stock Report Date Wise");
        addMenuItem(reports, "Stock Report Item Wise");
        addMenuItem(reports, "Voucher");
        addMenuItem(reports, "Post Dated Cheques");
        addMenuItem(reports, "Returned Cheques");
        addMenuItem(reports, "Aging Report");
        addMenuItem(reports, "Receivable");
        addMenuItem(reports, "Item Ledger");
        addMenuItem(reports, "Party Item Detail");
        addMenuItem(reports, "PC Profit Report");
        addMenuItem(reports, "Type Wise Item Report");
        addMenuItem(reports, "OS Cheques");
        addMenuItem(reports, "Party Activity Report");
        addMenuItem(security, "User Rights");
        addMenuItem(security, "Audit Log");
        JMenu helpMenu = new JMenu("Help");
        JMenuItem manual = new JMenuItem("User Manual");
        manual.addActionListener(e -> showScreen("Help"));
        helpMenu.add(manual);
        JMenuItem home = new JMenuItem("Home");
        home.addActionListener(e -> showScreen(HOME));
        window.add(home);
        bar.add(files); bar.add(masters); bar.add(transactions); bar.add(reports); bar.add(security); bar.add(window); bar.add(helpMenu);
        return bar;
    }

    private static void configureLookAndFeel() {
        System.setProperty("awt.useSystemAAFontSettings", "on");
        System.setProperty("swing.aatext", "true");
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (Exception ignored) {
            // Swing's default look and feel remains usable if the platform one is unavailable.
        }
        FontUIResource font = new FontUIResource("Dialog", Font.PLAIN, 14);
        for (Object key : UIManager.getDefaults().keySet()) {
            if (key.toString().toLowerCase().contains("font")) UIManager.put(key, font);
        }
    }

    private void addMenuItem(JMenu menu, String name) {
        JMenuItem item = new JMenuItem(name);
        item.setEnabled(isAllowed(name));
        item.addActionListener(e -> showScreen(name));
        menu.add(item);
    }

    private void showScreen(String name) {
        if (!isAllowed(name)) {
            status.setText("  Access denied: " + name);
            return;
        }
        refreshLinkedSelectors();
        navigateTo(name, true);
    }

    private boolean isAllowed(String screen) {
        if (activeUser == null || HOME.equals(screen) || "Help".equals(screen) || "Company Profile".equals(screen)) return true;
        String permission = permissionFor(screen);
        return permission == null || activeUser.getPermissions().contains(permission);
    }

    private String permissionFor(String screen) {
        if ("Audit Log".equals(screen)) return "User Rights";
        if ("Payment / Receipt".equals(screen)) return "Voucher";
        for (String permission : USER_PERMISSIONS) if (permission.equals(screen)) return permission;
        return "Reports";
    }

    private void navigateTo(String name, boolean recordHistory) {
        if (!screens.containsKey(name)) return;
        if (!isAllowed(name)) {
            status.setText("  Access denied: " + name);
            return;
        }
        if (recordHistory && !currentScreen.equals(name)) {
            backHistory.push(currentScreen);
            forwardHistory.clear();
        }
        currentScreen = name;
        layout.show(cards, name);
        status.setText("  Opened: " + name);
    }

    private void goBack() {
        if (backHistory.isEmpty()) {
            status.setText("  No previous screen");
            return;
        }
        String target = backHistory.pop();
        forwardHistory.push(currentScreen);
        navigateTo(target, false);
    }

    private void goForward() {
        if (forwardHistory.isEmpty()) {
            status.setText("  No next screen");
            return;
        }
        String target = forwardHistory.pop();
        backHistory.push(currentScreen);
        navigateTo(target, false);
    }

    private JToolBar toolbar(JFrame frame) {
        JToolBar toolbar = new JToolBar("Office actions");
        toolbar.setFloatable(false);
        toolbar.setRollover(true);
        toolbar.setBackground(new Color(235, 241, 246));
        toolbar.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, new Color(190, 205, 216)));
        JButton back = iconButton("back", "Back screen", "Moved to the previous screen");
        back.addActionListener(e -> goBack());
        toolbar.add(back);
        JButton forward = iconButton("forward", "Forward screen", "Moved to the next screen");
        forward.addActionListener(e -> goForward());
        toolbar.add(forward);
        toolbar.addSeparator();
        JButton home = iconButton("home", "Home dashboard", "Opened Home dashboard");
        home.addActionListener(e -> showScreen(HOME));
        toolbar.add(home);
        toolbar.addSeparator();
        JButton refresh = iconButton("refresh", "Refresh", "Current screen refreshed");
        refresh.addActionListener(e -> showScreen(currentScreen));
        toolbar.add(refresh);
        toolbar.addSeparator();
        JButton help = iconButton("help", "Help", "Opening user manual");
        help.addActionListener(e -> showScreen("Help"));
        toolbar.add(help);
        JButton exit = iconButton("exit", "Exit", "Application closed");
        exit.addActionListener(e -> frame.dispose());
        toolbar.add(exit);
        return toolbar;
    }

    private JButton iconButton(String iconName, String tooltip, final String result) {
        JButton button = new JButton(new ToolbarIcon(iconName));
        button.setToolTipText(tooltip);
        button.setFocusable(false);
        button.setBorder(BorderFactory.createEmptyBorder(5, 7, 5, 7));
        button.setContentAreaFilled(false);
        button.addActionListener(e -> status.setText("  " + result));
        return button;
    }

    private static final class ToolbarIcon implements Icon {
        private final String name;

        private ToolbarIcon(String name) { this.name = name; }

        @Override public int getIconWidth() { return 20; }
        @Override public int getIconHeight() { return 20; }

        @Override public void paintIcon(java.awt.Component component, Graphics graphics, int x, int y) {
            Graphics2D g = (Graphics2D) graphics.create();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setColor(new Color(45, 55, 65));
            g.setStroke(new BasicStroke(1.5f));
            if ("save".equals(name)) {
                g.drawRect(x + 3, y + 2, 14, 16); g.fillRect(x + 6, y + 3, 8, 4); g.drawRect(x + 6, y + 12, 8, 6);
            } else if ("new".equals(name)) {
                g.drawRect(x + 4, y + 2, 11, 16); g.drawLine(x + 7, y + 7, x + 13, y + 7); g.drawLine(x + 7, y + 10, x + 13, y + 10); g.drawLine(x + 7, y + 13, x + 11, y + 13);
            } else if ("delete".equals(name)) {
                g.drawRect(x + 5, y + 5, 10, 12); g.drawLine(x + 4, y + 4, x + 16, y + 4); g.drawLine(x + 8, y + 2, x + 12, y + 2); g.drawLine(x + 7, y + 8, x + 13, y + 14); g.drawLine(x + 13, y + 8, x + 7, y + 14);
            } else if ("back".equals(name)) {
                g.drawLine(x + 4, y + 10, x + 16, y + 10); g.drawLine(x + 4, y + 10, x + 9, y + 5); g.drawLine(x + 4, y + 10, x + 9, y + 15);
            } else if ("forward".equals(name)) {
                g.drawLine(x + 4, y + 10, x + 16, y + 10); g.drawLine(x + 16, y + 10, x + 11, y + 5); g.drawLine(x + 16, y + 10, x + 11, y + 15);
            } else if ("home".equals(name)) {
                g.drawLine(x + 3, y + 9, x + 10, y + 3); g.drawLine(x + 10, y + 3, x + 17, y + 9);
                g.drawRect(x + 5, y + 9, 10, 8); g.drawRect(x + 9, y + 12, 3, 5);
            } else if ("search".equals(name)) {
                g.drawOval(x + 3, y + 3, 10, 10); g.drawLine(x + 12, y + 12, x + 18, y + 18);
            } else if ("first".equals(name)) {
                g.drawLine(x + 5, y + 3, x + 5, y + 17); triangle(g, x + 16, y + 10, true); 
            } else if ("previous".equals(name)) {
                triangle(g, x + 5, y + 10, true);
            } else if ("next".equals(name)) {
                triangle(g, x + 15, y + 10, false);
            } else if ("last".equals(name)) {
                triangle(g, x + 5, y + 10, false); g.drawLine(x + 16, y + 3, x + 16, y + 17);
            } else if ("print".equals(name)) {
                g.drawRect(x + 5, y + 2, 10, 6); g.drawRect(x + 3, y + 7, 14, 7); g.drawRect(x + 6, y + 12, 8, 6);
            } else if ("refresh".equals(name)) {
                g.drawArc(x + 3, y + 3, 14, 14, 45, 270); triangle(g, x + 16, y + 4, false);
            } else if ("help".equals(name)) {
                g.drawOval(x + 3, y + 2, 14, 16); g.drawString("?", x + 8, y + 15);
            } else if ("exit".equals(name)) {
                g.drawRect(x + 4, y + 3, 9, 15); g.drawLine(x + 10, y + 10, x + 18, y + 10); g.drawLine(x + 15, y + 7, x + 18, y + 10); g.drawLine(x + 15, y + 13, x + 18, y + 10);
            }
            g.dispose();
        }

        private void triangle(Graphics2D g, int centerX, int centerY, boolean left) {
            int[] xs = left ? new int[] {centerX + 4, centerX - 4, centerX + 4} : new int[] {centerX - 4, centerX + 4, centerX - 4};
            int[] ys = new int[] {centerY - 5, centerY, centerY + 5};
            g.fillPolygon(xs, ys, 3);
        }
    }

    private JPanel home() {
        JPanel panel = page(companyProfile.load().getName());
        JPanel body = new JPanel(new BorderLayout(12, 12));

        JPanel greetingBar = new JPanel(new BorderLayout());
        JLabel greeting = new JLabel(greetingText());
        greeting.setFont(new Font("Dialog", Font.BOLD, 18));
        JLabel clock = new JLabel(clockText());
        clock.setFont(new Font("Dialog", Font.PLAIN, 14));
        greetingBar.add(greeting, BorderLayout.WEST);
        greetingBar.add(clock, BorderLayout.EAST);
        new Timer(1000, e -> {
            greeting.setText(greetingText());
            clock.setText(clockText());
        }).start();

        JPanel metrics = new JPanel(new GridLayout(2, 3, 10, 10));
        metrics.add(metric("Sales today", todayTotal(Challan.Type.SALE), "Posted sale challans"));
        metrics.add(metric("Purchases today", todayTotal(Challan.Type.PURCHASE), "Posted purchase challans"));
        metrics.add(metric("Receivables", "0.00", "No ledger data"));
        metrics.add(metric("Payables", "0.00", "No ledger data"));
        metrics.add(metric("Items", String.valueOf(itemCount()), "Clean-start catalog"));
        metrics.add(metric("Accounts", String.valueOf(accounts.findAll().size()), "Clean-start chart"));
        JPanel top = new JPanel(new BorderLayout(0, 8));
        top.add(greetingBar, BorderLayout.NORTH);
        top.add(metrics, BorderLayout.CENTER);
        body.add(top, BorderLayout.NORTH);

        // GridLayout gives the wrapped action area a real preferred height. A
        // plain FlowLayout reports the height of one row even after wrapping,
        // which allowed the empty-state panel to cover the lower rows.
        JPanel quick = new JPanel(new GridLayout(0, 3, 8, 8));
        quick.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createTitledBorder("Quick actions"),
                BorderFactory.createEmptyBorder(4, 4, 4, 4)));
        quick.add(goButton("Record Sale", "Sale Challan"));
        quick.add(goButton("Record Purchase", "Purchase Challan"));
        quick.add(goButton("Create Voucher", "Voucher"));
        quick.add(goButton("Manage Items", "Items"));
        quick.add(goButton("Manage Accounts", "Chart of Account"));
        quick.add(goButton("Transfer Stock", "Transfer"));

        JPanel center = new JPanel(new BorderLayout(12, 12));
        center.add(quick, BorderLayout.NORTH);
        JPanel emptyState = new JPanel(new BorderLayout());
        emptyState.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createTitledBorder("Pilot checklist"),
                BorderFactory.createEmptyBorder(8, 12, 8, 12)));
        JLabel message = new JLabel("<html><b>First-run checklist</b><br>1. Create the company profile<br>2. Create accounts and items<br>3. Enter opening stock<br>4. Record a purchase or sale</html>");
        message.setFont(new Font("Dialog", Font.PLAIN, 16));
        emptyState.add(message, BorderLayout.NORTH);
        center.add(emptyState, BorderLayout.CENTER);
        body.add(center, BorderLayout.CENTER);

        JPanel lower = new JPanel(new GridLayout(1, 2, 12, 0));
        lower.setPreferredSize(new Dimension(0, 96));
        lower.add(dashboardText("Attention", "No pending cheques\nNo low-stock items\nNo unposted vouchers"));
        lower.add(dashboardText("Recent activity", "No activity yet.\nNew records will appear here after saving."));
        body.add(lower, BorderLayout.SOUTH);
        panel.add(body, BorderLayout.CENTER);
        return panel;
    }

    private JPanel companyProfileScreen() {
        JPanel panel = page("Company Profile");
        JPanel form = titled("Office identity");
        CompanyProfile existing = companyProfile.load();
        JTextField[] fields = addEditableFields(form, new String[] {"Company Name", "Address", "Phone Number", "Fiscal Year", "Logo File"});
        fields[0].setText(existing.getName());
        fields[1].setText(existing.getAddress());
        fields[2].setText(existing.getPhone());
        fields[3].setText(existing.getFiscalYear());
        fields[4].setText(existing.getLogoPath());

        JPanel buttons = buttonBar();
        JButton browse = actionButton("Choose Logo File", "Choose a logo image file");
        browse.addActionListener(e -> {
            JFileChooser chooser = new JFileChooser();
            chooser.setDialogTitle("Choose company logo");
            if (chooser.showOpenDialog(cards) == JFileChooser.APPROVE_OPTION) fields[4].setText(chooser.getSelectedFile().getAbsolutePath());
        });
        buttons.add(browse);
        JButton save = actionButton("Save Company Profile", "Company profile saved");
        save.addActionListener(e -> {
            try {
                companyProfile.save(new CompanyProfile(fields[0].getText(), fields[1].getText(), fields[2].getText(), fields[3].getText(), fields[4].getText()));
                replaceScreen(HOME, home());
                status.setText("  Company profile saved; Home dashboard updated");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot save company profile: " + error.getMessage());
            }
        });
        buttons.add(save);
        addGrid(form, buttons, 0, 5, 2, 1, 1, 0);
        addScrollable(panel, form);
        return panel;
    }

    private String greetingText() {
        int hour = Integer.parseInt(new SimpleDateFormat("H").format(new Date()));
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }

    private String clockText() {
        return new SimpleDateFormat("EEEE, dd MMM yyyy  HH:mm:ss").format(new Date());
    }

    private boolean confirmDelete(String type, String code) {
        if (code == null || code.trim().isEmpty()) {
            status.setText("  Select a " + type + " before deleting");
            return false;
        }
        return JOptionPane.showConfirmDialog(cards, "Delete " + type + " '" + code + "'? This cannot be undone.", "Confirm deletion", JOptionPane.YES_NO_OPTION, JOptionPane.WARNING_MESSAGE) == JOptionPane.YES_OPTION;
    }

    private int itemCount() {
        return items.findAll().size();
    }

    private String todayTotal(Challan.Type type) {
        String today = new SimpleDateFormat("yyyy-MM-dd").format(new Date());
        BigDecimal total = BigDecimal.ZERO;
        for (Challan challan : challans.findAll()) if (type == challan.getType() && today.equals(challan.getDate())) total = total.add(challan.total());
        return total.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private JPanel metric(String title, String value, String detail) {
        JPanel card = new JPanel(new BorderLayout(4, 4));
        card.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(190, 200, 210)),
                BorderFactory.createEmptyBorder(10, 12, 10, 12)));
        JLabel titleLabel = new JLabel(title);
        JLabel valueLabel = new JLabel(value);
        valueLabel.setFont(new Font("Dialog", Font.BOLD, 22));
        JLabel detailLabel = new JLabel(detail);
        detailLabel.setForeground(new Color(100, 110, 120));
        card.add(titleLabel, BorderLayout.NORTH);
        card.add(valueLabel, BorderLayout.CENTER);
        card.add(detailLabel, BorderLayout.SOUTH);
        return card;
    }

    private JPanel dashboardText(String title, String text) {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createTitledBorder(title));
        JTextArea area = new JTextArea(text);
        area.setEditable(false);
        area.setOpaque(false);
        area.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        panel.add(area, BorderLayout.CENTER);
        return panel;
    }

    private JPanel chartOfAccounts() {
        JPanel panel = page("Chart of Account");
        JTree tree = new JTree(accountTree());
        tree.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        JPanel detail = new JPanel(new GridBagLayout());
        detail.setBorder(BorderFactory.createTitledBorder("Account Details"));
        JTextField[] fields = addEditableFields(detail, new String[] {"Account Code", "Account Description", "Opening Balance", "Cash / Bank Type", "Address", "Phone Number", "GST Number", "Mobile Number", "Fax Number", "NTN Number", "Account Type"});
        fields[0].setText(nextAccountCode());
        lockGeneratedId(fields[0]);
        JComboBox<String> parentSelector = new JComboBox<String>();
        parentSelector.setPrototypeDisplayValue("9999 - Long parent account description");
        refreshParentChoices(parentSelector);
        addGrid(detail, new JLabel("Parent Account"), 0, 11, 1, 1, 0, 0);
        addGrid(detail, parentSelector, 1, 11, 1, 1, 1, 0);
        JPanel buttons = buttonBar();
        final String[] selectedAccountCode = new String[1];
        JButton newAccount = new OfficeButton("New Account");
        newAccount.addActionListener(e -> {
            selectedAccountCode[0] = null;
            fields[0].setText(nextAccountCode()); fields[1].setText("");
            parentSelector.setSelectedIndex(0);
            status.setText("  New account entry");
        });
        buttons.add(newAccount);
        JButton subAccount = actionButton("Add Subaccount", "Select a parent account, then save the subaccount");
        subAccount.addActionListener(e -> {
            selectedAccountCode[0] = null;
            fields[0].setText(nextAccountCode()); fields[1].setText("");
            if (tree.getLastSelectedPathComponent() != null) {
                String code = accountCodeFromTreeNode(tree.getLastSelectedPathComponent());
                selectParent(parentSelector, code);
            }
            fields[0].requestFocusInWindow();
        });
        buttons.add(subAccount);
        JButton mainAccount = actionButton("Add Top-Level Account", "New top-level account selected");
        mainAccount.addActionListener(e -> parentSelector.setSelectedIndex(0));
        buttons.add(mainAccount);
        JButton save = new OfficeButton("Save Account");
        save.addActionListener(e -> {
            try {
                if (fields[0].getText().trim().isEmpty()) fields[0].setText(nextAccountCode());
                Account requested = new Account(fields[0].getText(), fields[1].getText(), selectedParentCode(parentSelector.getSelectedItem()));
                Account existing = findAccount(requested.getCode());
                if (existing != null && sameAccount(existing, requested)) {
                    clearAccountEntry(fields, parentSelector, selectedAccountCode);
                    status.setText("  Account already exists; duplicate ignored");
                    return;
                }
                String savedCode = requested.getCode();
                if (existing != null) {
                    savedCode = nextAvailableAccountCode(requested.getCode());
                    requested = new Account(savedCode, requested.getDescription(), requested.getParentCode());
                }
                accounts.save(requested);
                audit("ACCOUNT_SAVE", savedCode);
                tree.setModel(new DefaultTreeModel(accountTree()));
                refreshParentChoices(parentSelector);
                clearAccountEntry(fields, parentSelector, selectedAccountCode);
                status.setText(existing == null
                        ? "  Account " + savedCode + " saved and chart refreshed"
                        : "  Account code conflict resolved automatically: saved as " + savedCode);
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot save account: " + error.getMessage());
            }
        });
        buttons.add(save);
        JButton update = new OfficeButton("Update Account");
        update.addActionListener(e -> {
            try {
                accounts.update(new Account(fields[0].getText(), fields[1].getText(), selectedParentCode(parentSelector.getSelectedItem())));
                audit("ACCOUNT_UPDATE", fields[0].getText());
                tree.setModel(new DefaultTreeModel(accountTree()));
                refreshParentChoices(parentSelector);
                status.setText("  Account updated and chart refreshed");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot update account: " + error.getMessage());
            }
        });
        buttons.add(update);
        JButton delete = new OfficeButton("Delete Account");
        delete.addActionListener(e -> {
            String code = selectedAccountCode[0] == null ? fields[0].getText().trim() : selectedAccountCode[0];
            if (!confirmDelete("account", code)) return;
            try {
                accounts.deleteByCode(code);
                audit("ACCOUNT_DELETE", code);
                tree.setModel(new DefaultTreeModel(accountTree()));
                refreshParentChoices(parentSelector);
                fields[0].setText(""); fields[1].setText(""); selectedAccountCode[0] = null;
                status.setText("  Account deleted and chart refreshed");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot delete account: " + error.getMessage());
            }
        });
        buttons.add(delete);
        buttons.add(actionButton("Refresh Chart", "Chart refreshed"));
        addGrid(detail, buttons, 0, 12, 2, 1, 1, 0);
        tree.addTreeSelectionListener(e -> {
            String code = accountCodeFromTreeNode(tree.getLastSelectedPathComponent());
            if (code != null) {
                selectedAccountCode[0] = code;
                for (Account account : accounts.findAll()) if (code.equals(account.getCode())) {
                    fields[0].setText(account.getCode());
                    fields[1].setText(account.getDescription());
                    if (account.getParentCode() == null) parentSelector.setSelectedIndex(0);
                    else selectParent(parentSelector, account.getParentCode());
                }
            }
        });
        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, new JScrollPane(tree), new JScrollPane(detail));
        split.setDividerLocation(370);
        split.setResizeWeight(0.30);
        panel.add(split, BorderLayout.CENTER);
        return panel;
    }

    private Account findAccount(String code) {
        for (Account account : accounts.findAll()) if (account.getCode().equals(code)) return account;
        return null;
    }

    private boolean sameAccount(Account left, Account right) {
        return left.getDescription().equals(right.getDescription())
                && (left.getParentCode() == null ? right.getParentCode() == null : left.getParentCode().equals(right.getParentCode()));
    }

    private String nextAvailableAccountCode(String base) {
        try {
            BigInteger candidate = new BigInteger(base.trim()).add(BigInteger.ONE);
            while (findAccount(candidate.toString()) != null) candidate = candidate.add(BigInteger.ONE);
            return candidate.toString();
        } catch (NumberFormatException error) {
            return nextAccountCode();
        }
    }

    private String nextAccountCode() {
        int candidate = 1000;
        boolean used;
        do {
            used = findAccount(String.valueOf(candidate)) != null;
            if (used) candidate++;
        } while (used);
        return String.valueOf(candidate);
    }

    private String nextItemCode() {
        List<String> used = new ArrayList<String>();
        for (Item item : items.findAll()) used.add(item.getCode());
        return nextGeneratedId("ITEM-", used);
    }

    private String nextBankCode() {
        List<String> used = new ArrayList<String>();
        for (Bank bank : banks.findAll()) used.add(bank.getCode());
        return nextGeneratedId("BANK-", used);
    }

    private String nextChallanNumber(String title) {
        List<String> used = new ArrayList<String>();
        for (Challan challan : challans.findAll()) used.add(challan.getNumber());
        return nextGeneratedId(title.startsWith("Purchase") ? "PUR-" : "SAL-", used);
    }

    private String nextVoucherNumber() {
        List<String> used = new ArrayList<String>();
        for (PostedVoucher voucher : vouchers.findAll()) used.add(voucher.getNumber());
        return nextGeneratedId("VCH-", used);
    }

    private String nextChequeNumber() {
        List<String> used = new ArrayList<String>();
        for (Cheque cheque : cheques.findAll()) used.add(cheque.getNumber());
        return nextGeneratedId("CHQ-", used);
    }

    private String nextGeneratedId(String prefix, List<String> used) {
        int candidate = 1;
        while (used.contains(prefix + String.format("%03d", candidate))) candidate++;
        return prefix + String.format("%03d", candidate);
    }

    private void clearAccountEntry(JTextField[] fields, JComboBox<String> parentSelector, String[] selectedAccountCode) {
        fields[0].setText("");
        fields[1].setText("");
        selectedAccountCode[0] = null;
        parentSelector.setSelectedIndex(0);
    }

    private DefaultMutableTreeNode accountTree() {
        DefaultMutableTreeNode root = new DefaultMutableTreeNode("Accounts");
        for (Account account : accounts.findAll()) if (account.getParentCode() == null) addAccountNode(root, account);
        return root;
    }

    private void addAccountNode(DefaultMutableTreeNode parent, Account account) {
        DefaultMutableTreeNode node = new DefaultMutableTreeNode(account.toString());
        parent.add(node);
        for (Account child : accounts.findAll()) if (account.getCode().equals(child.getParentCode())) addAccountNode(node, child);
    }

    private void refreshParentChoices(JComboBox<String> selector) {
        selector.removeAllItems();
        selector.addItem("(Top-level account)");
        for (Account account : accounts.findAll()) {
            selector.addItem(account.getCode() + " - " + account.getDescription());
        }
    }

    private String selectedParentCode(Object selected) {
        if (selected == null || "(Top-level account)".equals(selected.toString())) return null;
        String value = selected.toString();
        int separator = value.indexOf(" - ");
        return separator < 0 ? value.trim() : value.substring(0, separator).trim();
    }

    private void selectParent(JComboBox<String> selector, String code) {
        if (code == null) return;
        for (int i = 0; i < selector.getItemCount(); i++) {
            if (code.equals(selectedParentCode(selector.getItemAt(i)))) {
                selector.setSelectedIndex(i);
                return;
            }
        }
    }

    private String accountCodeFromTreeNode(Object selected) {
        if (!(selected instanceof DefaultMutableTreeNode)) return null;
        String text = String.valueOf(((DefaultMutableTreeNode) selected).getUserObject());
        int open = text.lastIndexOf('(');
        int close = text.lastIndexOf(')');
        return open >= 0 && close > open ? text.substring(open + 1, close).trim() : null;
    }

    private JPanel itemScreen() {
        JPanel panel = page("Items");
        JPanel form = titled("Item Details");
        JTextField[] fields = addEditableFields(form, new String[] {"Item Code", "Description", "Unit", "Sale Rate", "Purchase Rate"});
        JComboBox<String> stockType = stockTypeSelector();
        addGrid(form, new JLabel("Stock Type"), 0, 5, 1, 1, 0, 0);
        addGrid(form, stockType, 1, 5, 1, 1, 0, 0);
        fields[0].setText(nextItemCode());
        lockGeneratedId(fields[0]);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][6], new String[] {"Item Code", "Description", "Unit", "Sale Rate", "Purchase Rate", "Stock Type"});
        for (Item item : items.findAll()) model.addRow(itemRow(item));
        JTable itemTable = new JTable(model);
        itemTable.setRowHeight(26);
        final String[] selectedItemCode = new String[1];
        itemTable.getSelectionModel().addListSelectionListener(e -> {
            int row = itemTable.getSelectedRow();
            if (row < 0) return;
            selectedItemCode[0] = String.valueOf(model.getValueAt(row, 0));
            for (int i = 0; i < fields.length; i++) fields[i].setText(String.valueOf(model.getValueAt(row, i)));
            selectStockType(stockType, String.valueOf(model.getValueAt(row, 5)));
        });
        JButton newItem = new OfficeButton("New Item");
        newItem.addActionListener(e -> {
            selectedItemCode[0] = null;
            for (JTextField field : fields) field.setText("");
            fields[0].setText(nextItemCode());
            stockType.setSelectedIndex(0);
            itemTable.clearSelection();
            status.setText("  New item entry");
        });
        JButton save = new OfficeButton("Save Item");
        save.addActionListener(e -> {
            try {
                if (fields[0].getText().trim().isEmpty()) fields[0].setText(nextItemCode());
                BigDecimal saleRate = decimalOrZero(fields[3].getText());
                BigDecimal purchaseRate = decimalOrZero(fields[4].getText());
                Item item = new Item(fields[0].getText(), fields[1].getText(), fields[2].getText(), saleRate, purchaseRate, selectedStockType(stockType.getSelectedItem()));
                items.save(item);
                audit("ITEM_SAVE", item.getCode());
                model.addRow(itemRow(item));
                for (JTextField field : fields) field.setText("");
                stockType.setSelectedIndex(0);
                selectedItemCode[0] = null;
                status.setText("  Item saved and available to purchase/sale screens");
            } catch (NumberFormatException error) {
                status.setText("  Item rates must be numbers");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot save item: " + error.getMessage());
            }
        });
        JButton update = new OfficeButton("Update Item");
        update.addActionListener(e -> {
            try {
                BigDecimal saleRate = decimalOrZero(fields[3].getText());
                BigDecimal purchaseRate = decimalOrZero(fields[4].getText());
                Item item = new Item(fields[0].getText(), fields[1].getText(), fields[2].getText(), saleRate, purchaseRate, selectedStockType(stockType.getSelectedItem()));
                items.update(item);
                audit("ITEM_UPDATE", item.getCode());
                int row = itemTable.getSelectedRow();
                if (row >= 0) for (int i = 0; i < 6; i++) model.setValueAt(itemRow(item)[i], row, i);
                status.setText("  Item updated");
            } catch (NumberFormatException error) {
                status.setText("  Item rates must be numbers");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot update item: " + error.getMessage());
            }
        });
        JButton delete = new OfficeButton("Delete Item");
        delete.addActionListener(e -> {
            int row = itemTable.getSelectedRow();
            String code = row < 0 ? selectedItemCode[0] : String.valueOf(model.getValueAt(row, 0));
            if (!confirmDelete("item", code)) return;
            try {
                items.deleteByCode(code);
                audit("ITEM_DELETE", code);
                if (row >= 0) model.removeRow(row);
                for (JTextField field : fields) field.setText("");
                stockType.setSelectedIndex(0);
                selectedItemCode[0] = null;
                status.setText("  Item deleted");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot delete item: " + error.getMessage());
            }
        });
        JPanel buttons = buttonBar();
        buttons.add(newItem); buttons.add(save); buttons.add(update); buttons.add(delete);
        addGrid(form, buttons, 0, 7, 2, 1, 1, 0);
        JPanel tablePanel = new JPanel(new BorderLayout());
        tablePanel.add(new JScrollPane(itemTable), BorderLayout.CENTER);
        addFormAndTable(panel, form, tablePanel);
        return panel;
    }

    private JPanel bankScreen() {
        JPanel panel = page("Bank");
        JPanel form = titled("Bank Details");
        JTextField[] fields = addEditableFields(form, new String[] {"Bank Code", "Bank Name", "Account Number", "Opening Balance", "Address", "Phone Number"});
        fields[0].setText(nextBankCode());
        lockGeneratedId(fields[0]);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][6], new String[] {"Bank Code", "Bank Name", "Account Number", "Opening Balance", "Address", "Phone Number"});
        for (Bank bank : banks.findAll()) model.addRow(bankRow(bank));
        JTable table = new JTable(model);
        table.setRowHeight(26);
        JButton newBank = new OfficeButton("New Bank");
        newBank.addActionListener(e -> {
            for (JTextField field : fields) field.setText("");
            fields[0].setText(nextBankCode());
            table.clearSelection();
            status.setText("  New bank entry");
        });
        table.getSelectionModel().addListSelectionListener(e -> {
            int row = table.getSelectedRow();
            if (row < 0) return;
            for (int i = 0; i < fields.length; i++) fields[i].setText(String.valueOf(model.getValueAt(row, i)));
        });
        JPanel tablePanel = new JPanel(new BorderLayout());
        tablePanel.add(new JScrollPane(table), BorderLayout.CENTER);
        JButton save = new OfficeButton("Save Bank");
        save.addActionListener(e -> {
            try {
                if (fields[0].getText().trim().isEmpty()) fields[0].setText(nextBankCode());
                String balanceText = fields[3].getText().trim();
                BigDecimal balance = balanceText.isEmpty() ? BigDecimal.ZERO : new BigDecimal(balanceText);
                Bank bank = new Bank(fields[0].getText(), fields[1].getText(), fields[2].getText(), balance, fields[4].getText(), fields[5].getText());
                banks.save(bank);
                audit("BANK_SAVE", bank.getCode());
                model.addRow(bankRow(bank));
                for (JTextField field : fields) field.setText("");
                refreshBankSelector();
                status.setText("  Bank saved and available to cheque/payment screens");
            } catch (NumberFormatException error) {
                status.setText("  Opening balance must be a number");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot save bank: " + error.getMessage());
            }
        });
        JButton delete = new OfficeButton("Delete Selected Bank");
        delete.addActionListener(e -> {
            int row = table.getSelectedRow();
            if (row < 0) {
                status.setText("  Select a bank before deleting");
                return;
            }
            if (!confirmDelete("bank", String.valueOf(model.getValueAt(row, 0)))) return;
            try {
                banks.deleteByCode(String.valueOf(model.getValueAt(row, 0)));
                audit("BANK_DELETE", String.valueOf(model.getValueAt(row, 0)));
                model.removeRow(row);
                refreshBankSelector();
                status.setText("  Bank deleted");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot delete bank: " + error.getMessage());
            }
        });
        JButton update = new OfficeButton("Update Selected Bank");
        update.addActionListener(e -> {
            int row = table.getSelectedRow();
            if (row < 0) {
                status.setText("  Select a bank before updating");
                return;
            }
            try {
                String balanceText = fields[3].getText().trim();
                BigDecimal balance = balanceText.isEmpty() ? BigDecimal.ZERO : new BigDecimal(balanceText);
                Bank bank = new Bank(fields[0].getText(), fields[1].getText(), fields[2].getText(), balance, fields[4].getText(), fields[5].getText());
                banks.update(bank);
                Object[] values = {bank.getCode(), bank.getName(), bank.getAccountNumber(), bank.getOpeningBalance(), bank.getAddress(), bank.getPhone()};
                for (int i = 0; i < values.length; i++) model.setValueAt(values[i], row, i);
                refreshBankSelector();
                status.setText("  Bank updated");
            } catch (NumberFormatException error) {
                status.setText("  Opening balance must be a number");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot update bank: " + error.getMessage());
            }
        });
        JPanel buttons = buttonBar();
        buttons.add(newBank);
        buttons.add(save);
        buttons.add(update);
        buttons.add(delete);
        tablePanel.add(buttons, BorderLayout.SOUTH);
        addGrid(form, save, 0, 7, 2, 1, 1, 0);
        addFormAndTable(panel, form, tablePanel);
        return panel;
    }

    private JPanel chequeScreen() {
        JPanel panel = page("Cheque Detail");
        JPanel form = titled("Cheque Record");
        JTextField number = new JTextField(20);
        number.setText(nextChequeNumber());
        lockGeneratedId(number);
        JTextField manualId = new JTextField(20);
        JTextField date = fieldForLabel("Cheque Date", 12, true);
        JComboBox<String> party = partySelector();
        JTextField amount = new JTextField(12);
        addGrid(form, new JLabel("Check Voucher"), 0, 0, 1, 1, 0, 0); addGrid(form, number, 1, 0, 1, 1, 1, 0);
        addGrid(form, new JLabel("Check Number"), 0, 1, 1, 1, 0, 0); addGrid(form, manualId, 1, 1, 1, 1, 1, 0);
        chequeBankSelector = new JComboBox<String>();
        refreshBankSelector();
        addGrid(form, new JLabel("Bank"), 0, 2, 1, 1, 0, 0); addGrid(form, chequeBankSelector, 1, 2, 1, 1, 1, 0);
        addGrid(form, new JLabel("Cheque Date (yyyy-MM-dd)"), 0, 3, 1, 1, 0, 0); addGrid(form, date, 1, 3, 1, 1, 0, 0); addGrid(form, calendarButton(date), 2, 3, 1, 1, 0, 0);
        addGrid(form, new JLabel("Party"), 0, 4, 1, 1, 0, 0); addGrid(form, party, 1, 4, 1, 1, 1, 0);
        addGrid(form, new JLabel("Amount"), 0, 5, 1, 1, 0, 0); addGrid(form, amount, 1, 5, 1, 1, 1, 0);
        JComboBox<String> statusChoice = new JComboBox<String>(new String[] {"PENDING", "CLEARED", "RETURNED"});
        addGrid(form, new JLabel("Status"), 0, 6, 1, 1, 0, 0); addGrid(form, statusChoice, 1, 6, 1, 1, 1, 0);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][7], new String[] {"Check Voucher", "Check Number", "Bank", "Cheque Date", "Party", "Amount", "Status"});
        for (Cheque cheque : cheques.findAll()) addChequeRow(model, cheque);
        JTable table = new JTable(model);
        table.getSelectionModel().addListSelectionListener(event -> {
            if (event.getValueIsAdjusting() || table.getSelectedRow() < 0) return;
            int row = table.convertRowIndexToModel(table.getSelectedRow());
            number.setText(String.valueOf(model.getValueAt(row, 0)));
            manualId.setText(String.valueOf(model.getValueAt(row, 1)));
            selectBank(chequeBankSelector, String.valueOf(model.getValueAt(row, 2)));
            date.setText(String.valueOf(model.getValueAt(row, 3)));
            party.setSelectedItem(accountDisplay(String.valueOf(model.getValueAt(row, 4))));
            amount.setText(String.valueOf(model.getValueAt(row, 5)));
            statusChoice.setSelectedItem(String.valueOf(model.getValueAt(row, 6)));
        });
        JButton save = actionButton("Save Cheque", "Cheque saved to " + storageName());
        save.addActionListener(e -> {
            try {
                if (number.getText().trim().isEmpty()) number.setText(nextChequeNumber());
                String bank = selectedBankCode(chequeBankSelector.getSelectedItem());
                Cheque cheque = new Cheque(number.getText(), bank, date.getText(), selectedAccountCode(party.getSelectedItem()), new BigDecimal(amount.getText().trim()), String.valueOf(statusChoice.getSelectedItem()), manualId.getText().trim());
                cheques.save(cheque);
                audit("CHEQUE_SAVE", cheque.getNumber());
                upsertChequeRow(model, cheque);
                status.setText("  Cheque saved to " + storageName());
            } catch (NumberFormatException error) { status.setText("  Cheque amount must be a number"); }
            catch (IllegalArgumentException error) { status.setText("  Cannot save cheque: " + error.getMessage()); }
        });
        JButton search = actionButton("Search Cheques", "Cheque search completed");
        search.addActionListener(e -> {
            model.setRowCount(0);
            String requestedNumber = number.getText().trim();
            String requestedBank = selectedBankCode(chequeBankSelector.getSelectedItem());
            for (Cheque cheque : cheques.findAll()) if ((requestedNumber.isEmpty() || cheque.getNumber().equalsIgnoreCase(requestedNumber)) && (requestedBank.isEmpty() || requestedBank.equals(cheque.getBankCode()))) addChequeRow(model, cheque);
            status.setText("  Cheque search: " + model.getRowCount() + " row(s)");
        });
        JButton history = actionButton("View Status History", "Cheque history loaded");
        history.addActionListener(e -> {
            String requestedNumber = number.getText().trim();
            if (requestedNumber.isEmpty()) { status.setText("  Enter a cheque number first"); return; }
            StringBuilder text = new StringBuilder("Status history for ").append(requestedNumber).append("\n\n");
            for (com.purchasesale.domain.ChequeStatusChange change : cheques.history(requestedNumber)) text.append(change.getChangedAt()).append("  ").append(change.getStatus()).append("\n");
            JOptionPane.showMessageDialog(cards, text.length() > requestedNumber.length() + 2 ? text.toString() : "No history found.", "Cheque status history", JOptionPane.INFORMATION_MESSAGE);
        });
        JPanel buttons = buttonBar(); buttons.add(save); buttons.add(search); buttons.add(history);
        addGrid(form, buttons, 0, 7, 2, 1, 1, 0);
        addFormAndTable(panel, form, new JScrollPane(table));
        return panel;
    }

    private void addChequeRow(DefaultTableModel model, Cheque cheque) { model.addRow(new Object[] {cheque.getNumber(), cheque.getManualId(), cheque.getBankCode(), cheque.getDate(), cheque.getParty(), cheque.getAmount(), cheque.getStatus()}); }

    private void upsertChequeRow(DefaultTableModel model, Cheque cheque) {
        for (int row = 0; row < model.getRowCount(); row++) {
            if (cheque.getNumber().equals(String.valueOf(model.getValueAt(row, 0)))) {
                for (int column = 0; column < 7; column++) model.setValueAt(chequeRow(cheque)[column], row, column);
                return;
            }
        }
        addChequeRow(model, cheque);
    }

    private Object[] chequeRow(Cheque cheque) {
        return new Object[] {cheque.getNumber(), cheque.getManualId(), cheque.getBankCode(), cheque.getDate(), cheque.getParty(), cheque.getAmount(), cheque.getStatus()};
    }

    private Object[] itemRow(Item item) {
        return new Object[] {item.getCode(), item.getDescription(), item.getUnit(), item.getSaleRate(), item.getPurchaseRate(), item.getStockType()};
    }

    private Object[] bankRow(Bank bank) {
        return new Object[] {bank.getCode(), bank.getName(), bank.getAccountNumber(), bank.getOpeningBalance(), bank.getAddress(), bank.getPhone()};
    }

    private void refreshBankSelector() {
        if (chequeBankSelector == null) return;
        chequeBankSelector.removeAllItems();
        if (banks.findAll().isEmpty()) chequeBankSelector.addItem("(no banks created)");
        for (Bank bank : banks.findAll()) chequeBankSelector.addItem(bank.getCode() + " - " + bank.getName());
    }

    private String selectedBankCode(Object value) {
        if (value == null || String.valueOf(value).startsWith("(no banks")) return "";
        String text = String.valueOf(value);
        int separator = text.indexOf(" - ");
        return separator < 0 ? text : text.substring(0, separator).trim();
    }

    private void selectBank(JComboBox<String> selector, String code) {
        for (int i = 0; i < selector.getItemCount(); i++) {
            if (code.equals(selectedBankCode(selector.getItemAt(i)))) {
                selector.setSelectedIndex(i);
                return;
            }
        }
    }

    private String accountDisplay(String code) {
        for (Account account : accounts.findAll()) {
            if (code.equals(account.getCode())) return account.getCode() + " - " + account.getDescription();
        }
        return code;
    }

    private JPanel openingBalancesScreen() {
        JPanel panel = page("Item Opening Balances");
        JPanel form = inlineTitled("Opening Balance");
        JComboBox<String> itemCode = itemSelector();
        form.add(new JLabel("Item Code")); form.add(itemCode);
        JComboBox<String> location = locationSelector(true);
        form.add(new JLabel("Location")); form.add(location);
        JTextField quantity = inlineField(form, "Opening Quantity", 10);
        JTextField rate = inlineField(form, "Opening Rate", 10);
        rate.setEditable(false);
        rate.setToolTipText("Uses the selected item's purchase rate");
        itemCode.addActionListener(e -> {
            Item selected = items.findByCode(selectedItemCode(itemCode.getSelectedItem()));
            rate.setText(selected == null ? "" : selected.getPurchaseRate().toPlainString());
        });
        final DefaultTableModel model = new DefaultTableModel(new Object[0][6], new String[] {"Item Code", "Item Description", "Location", "Quantity", "Rate", "Amount"});
        for (com.purchasesale.domain.StockMovement movement : inventory.movements()) {
            if (!"OPENING".equals(movement.getType())) continue;
            Item savedItem = items.findByCode(movement.getItemCode());
            model.addRow(new Object[] {movement.getItemCode(), savedItem == null ? "" : savedItem.getDescription(), movement.getLocation(), movement.getQuantity(), movement.getRate(), movement.getAmount()});
        }
        JTable table = new JTable(model);
        table.setRowHeight(26);
        JButton save = new OfficeButton("Save Opening Balance");
        save.addActionListener(e -> {
            try {
                String selectedCode = selectedItemCode(itemCode.getSelectedItem());
                Item item = items.findByCode(selectedCode);
                if (item == null) throw new IllegalArgumentException("Select an existing item");
                BigDecimal openingQuantity = new BigDecimal(quantity.getText().trim());
                BigDecimal openingRate = new BigDecimal(rate.getText().trim());
                String locationName = selectedText(location);
                BigDecimal amount = inventory.openingBalance(item.getCode(), locationName, openingQuantity, openingRate);
                model.addRow(new Object[] {item.getCode(), item.getDescription(), locationName, openingQuantity, openingRate, amount});
                itemCode.setSelectedIndex(0); location.getEditor().setItem(""); quantity.setText(""); rate.setText("");
                status.setText("  Opening balance saved and stock updated");
            } catch (NumberFormatException error) {
                status.setText("  Opening quantity and rate must be numbers");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot save opening balance: " + error.getMessage());
            }
        });
        form.add(save);
        JPanel tablePanel = new JPanel(new BorderLayout());
        tablePanel.add(new JScrollPane(table), BorderLayout.CENTER);
        addFormAndTable(panel, form, tablePanel);
        return panel;
    }

    private JPanel stockTypesScreen() {
        JPanel panel = page("Stock Types");
        JPanel form = titled("Stock Type");
        JTextField code = new JTextField(12);
        JTextField description = new JTextField(20);
        addGrid(form, new JLabel("Stock Type Code"), 0, 0, 1, 1, 0, 0); addGrid(form, code, 1, 0, 1, 1, 0, 0);
        addGrid(form, new JLabel("Description"), 0, 1, 1, 1, 0, 0); addGrid(form, description, 1, 1, 1, 1, 0, 0);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][2], new String[] {"Stock Type Code", "Description"});
        for (Map.Entry<String, String> entry : stockTypes.entrySet()) model.addRow(new Object[] {entry.getKey(), entry.getValue()});
        JTable table = new JTable(model);
        JButton save = new OfficeButton("Save Stock Type");
        save.addActionListener(e -> {
            try {
                String key = code.getText().trim();
                String name = description.getText().trim();
                if (key.isEmpty() || name.isEmpty()) throw new IllegalArgumentException("Code and description are required");
                if (stockTypes.containsKey(key)) throw new IllegalArgumentException("Stock type code already exists: " + key);
                if (persistence instanceof SQLiteOfficeData) ((SQLiteOfficeData) persistence).saveStockType(key, name);
                stockTypes.put(key, name);
                model.addRow(new Object[] {key, name});
                refreshStockTypeSelectors();
                audit("STOCK_TYPE_SAVE", key);
                code.setText(""); description.setText("");
                status.setText("  Stock type " + key + " saved and available in Items");
            } catch (IllegalArgumentException error) { status.setText("  Cannot save stock type: " + error.getMessage()); }
        });
        addGrid(form, save, 0, 2, 2, 1, 0, 0);
        addFormAndTable(panel, form, new JScrollPane(table));
        return panel;
    }

    private JPanel voucherScreen(String title) {
        JPanel panel = page(title);
        JPanel header = titled("Voucher Header");
        JTextField[] headerFields = addFields(header, new String[] {"Voucher Number", "Voucher Date", "Narration", "Reference"});
        headerFields[0].setText(nextVoucherNumber());
        lockGeneratedId(headerFields[0]);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][4], new String[] {"Account Code", "Account Description", "Debit", "Credit"});
        JTable table = new JTable(model);
        table.setRowHeight(26);
        JComboBox<String> voucherAccountSelector = accountSelector();
        table.getColumnModel().getColumn(0).setCellEditor(new DefaultCellEditor(voucherAccountSelector));
        JPanel tablePanel = new JPanel(new BorderLayout());
        tablePanel.add(new JScrollPane(table), BorderLayout.CENTER);
        JButton addLine = new OfficeButton("Add Voucher Line");
        addLine.addActionListener(e -> model.addRow(new Object[] {"", "", "0", "0"}));
        JButton validate = new OfficeButton("Validate Voucher");
        validate.addActionListener(e -> {
            try {
                JournalVoucher voucher = new JournalVoucher();
                for (int row = 0; row < model.getRowCount(); row++) {
                    BigDecimal debit = decimalOrZero(String.valueOf(model.getValueAt(row, 2)));
                    BigDecimal credit = decimalOrZero(String.valueOf(model.getValueAt(row, 3)));
                    voucher.add(selectedAccountCode(model.getValueAt(row, 0)), debit, credit);
                }
                voucher.validateBalanced();
                status.setText("  " + title + " is balanced and ready to post");
            } catch (IllegalArgumentException error) {
                status.setText("  " + title + " is not valid: " + error.getMessage());
            }
        });
        JButton post = new OfficeButton("Post Voucher");
        post.addActionListener(e -> {
            try {
                if (headerFields[0].getText().trim().isEmpty()) headerFields[0].setText(nextVoucherNumber());
                if (headerFields[1].getText().trim().isEmpty()) headerFields[1].setText(todayIso());
                JournalVoucher voucher = voucherFromTable(model);
                PostedVoucher posted = new PostedVoucher(headerFields[0].getText(), headerFields[1].getText(), headerFields[2].getText(), headerFields[3].getText(), voucher);
                vouchers.save(posted);
                audit("VOUCHER_POST", posted.getNumber());
                model.setRowCount(0);
                for (JTextField field : headerFields) field.setText("");
                status.setText("  " + title + " " + posted.getNumber() + " posted");
            } catch (NumberFormatException error) {
                status.setText("  Voucher amounts must be numbers");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot post " + title + ": " + error.getMessage());
            }
        });
        JButton print = actionButton("Print Voucher", "Voucher print requested");
        print.addActionListener(e -> printVoucher(title, headerFields, model));
        JPanel buttons = buttonBar();
        buttons.add(addLine); buttons.add(validate); buttons.add(post); buttons.add(print);
        tablePanel.add(buttons, BorderLayout.SOUTH);
        addFormAndTable(panel, header, tablePanel);
        return panel;
    }

    private JournalVoucher voucherFromTable(DefaultTableModel model) {
        JournalVoucher voucher = new JournalVoucher();
        for (int row = 0; row < model.getRowCount(); row++) {
            voucher.add(selectedAccountCode(model.getValueAt(row, 0)), decimalOrZero(String.valueOf(model.getValueAt(row, 2))), decimalOrZero(String.valueOf(model.getValueAt(row, 3))));
        }
        voucher.validateBalanced();
        return voucher;
    }

    private JPanel challanScreen(String title) {
        JPanel panel = page(title);
        JPanel header = inlineTitled(title + " Header");
        JTextField challanNumber = inlineField(header, "Challan Number", 10);
        challanNumber.setText(nextChallanNumber(title));
        lockGeneratedId(challanNumber);
        JTextField challanDate = inlineField(header, "Challan Date", 10);
        challanDate.setText(todayIso());
        JComboBox<String> party = partySelector();
        header.add(new JLabel("Party")); header.add(party);
        JComboBox<String> location = locationSelector(true);
        header.add(new JLabel("Location")); header.add(location);
        JComboBox<String> itemCode = itemSelector();
        JButton search = new OfficeButton("Search Challans");
        header.add(search);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][6], new String[] {"Item Code", "Description", "Unit", "Quantity", "Rate", "Amount"}) {
            @Override public boolean isCellEditable(int row, int column) { return column == 0 || column == 3; }
        };
        JTable table = new JTable(model);
        table.setRowHeight(26);
        table.getColumnModel().getColumn(0).setCellEditor(new DefaultCellEditor(itemCode));
        table.getColumnModel().getColumn(0).setPreferredWidth(190);
        table.getColumnModel().getColumn(1).setPreferredWidth(190);
        table.getColumnModel().getColumn(4).setCellRenderer(new javax.swing.table.DefaultTableCellRenderer() {
            @Override public java.awt.Component getTableCellRendererComponent(JTable table, Object value, boolean selected, boolean focused, int row, int column) {
                java.awt.Component component = super.getTableCellRendererComponent(table, value, selected, focused, row, column);
                component.setBackground(selected ? table.getSelectionBackground() : new Color(238, 242, 246));
                return component;
            }
        });
        JPanel tablePanel = new JPanel(new BorderLayout());
        tablePanel.add(new JScrollPane(table), BorderLayout.CENTER);
        JLabel total = new JLabel("Total Amount: 0.00");
        model.addTableModelListener(event -> {
            int row = event.getFirstRow();
            int column = event.getColumn();
            if (row >= 0 && row < model.getRowCount() && (column == 0 || column == 3)) {
                if (column == 0) {
                    Item item = items.findByCode(selectedItemCode(model.getValueAt(row, 0)));
                    if (item != null) {
                        model.setValueAt(item.getDescription(), row, 1);
                        model.setValueAt(item.getUnit(), row, 2);
                        BigDecimal itemRate = title.startsWith("Purchase") ? item.getPurchaseRate() : item.getSaleRate();
                        model.setValueAt(itemRate, row, 4);
                    }
                }
                try {
                    BigDecimal qty = new BigDecimal(String.valueOf(model.getValueAt(row, 3)));
                    BigDecimal unitRate = new BigDecimal(String.valueOf(model.getValueAt(row, 4)));
                    model.setValueAt(qty.multiply(unitRate), row, 5);
                } catch (NumberFormatException ignored) {
                    model.setValueAt("", row, 5);
                }
            }
            total.setText("Total Amount: " + challanTotal(model).toPlainString());
        });
        search.addActionListener(e -> {
            model.setRowCount(0);
            String requestedNumber = challanNumber.getText().trim();
            String requestedParty = selectedAccountCode(party.getSelectedItem());
            String requestedDate = challanDate.getText().trim();
            int found = 0;
            for (Challan challan : challans.findAll()) {
                boolean correctType = title.startsWith("Purchase") ? challan.getType() == Challan.Type.PURCHASE : challan.getType() == Challan.Type.SALE;
                boolean matches = correctType
                        && (requestedNumber.isEmpty() || challan.getNumber().equalsIgnoreCase(requestedNumber))
                        && (requestedParty.isEmpty() || challan.getParty().toLowerCase().contains(requestedParty.toLowerCase()))
                        && (requestedDate.isEmpty() || challan.getDate().equals(requestedDate));
                if (!matches) continue;
                challanNumber.setText(challan.getNumber());
                challanDate.setText(challan.getDate());
                selectParent(party, challan.getParty());
                location.setSelectedItem(challan.getLocation());
                for (Challan.Line line : challan.getLines()) {
                    Item item = items.findByCode(line.getItemCode());
                    model.addRow(new Object[] {item == null ? line.getItemCode() : item.getCode() + " - " + item.getDescription(), item == null ? "" : item.getDescription(), item == null ? "" : item.getUnit(), line.getQuantity(), line.getRate(), line.amount()});
                }
                total.setText("Total Amount: " + challan.total().toPlainString());
                found++;
            }
            status.setText("  " + found + " " + title.toLowerCase() + " document(s) found");
        });
        JPanel buttons = buttonBar();
        JButton addLine = new OfficeButton("Add Item Row");
        addLine.addActionListener(e -> {
            model.addRow(new Object[] {"(select item)", "", "", "1", "", "0.00"});
            int newRow = model.getRowCount() - 1;
            table.setRowSelectionInterval(newRow, newRow);
            table.editCellAt(newRow, 0);
            table.requestFocusInWindow();
        });
        JButton removeLine = new OfficeButton("Remove Selected Line");
        removeLine.addActionListener(e -> {
            if (table.isEditing()) table.getCellEditor().stopCellEditing();
            int row = table.getSelectedRow();
            if (row < 0) {
                status.setText("  Select a challan line before removing it");
                return;
            }
            model.removeRow(row);
            total.setText("Total Amount: " + challanTotal(model).toPlainString());
            status.setText("  Challan line removed");
        });
        JButton post = new OfficeButton("Post Challan");
        post.addActionListener(e -> {
            try {
                if (challanNumber.getText().trim().isEmpty()) challanNumber.setText(nextChallanNumber(title));
                if (challanDate.getText().trim().isEmpty()) challanDate.setText(todayIso());
                List<Challan.Line> lines = new ArrayList<Challan.Line>();
                if (table.isEditing() && !table.getCellEditor().stopCellEditing()) throw new IllegalArgumentException("Finish editing the current challan row");
                for (int row = 0; row < model.getRowCount(); row++) {
                    String lineItemCode = selectedItemCode(model.getValueAt(row, 0));
                    BigDecimal lineQuantity = new BigDecimal(String.valueOf(model.getValueAt(row, 3)));
                    BigDecimal lineRate = new BigDecimal(String.valueOf(model.getValueAt(row, 4)));
                    lines.add(new Challan.Line(lineItemCode, lineQuantity, lineRate));
                }
                Challan challan = new Challan(
                        title.startsWith("Purchase") ? Challan.Type.PURCHASE : Challan.Type.SALE,
                        challanNumber.getText(), challanDate.getText(), selectedAccountCode(party.getSelectedItem()), selectedText(location), lines);
                if (challans.containsNumber(challan.getNumber())) throw new IllegalArgumentException("Challan number already exists: " + challan.getNumber());
                BigDecimal amount;
                if (persistence instanceof SQLiteOfficeData) {
                    inventory.validateChallan(challan);
                    ((SQLiteOfficeData) persistence).saveChallanAndMovements(challan);
                    inventory.applyPersistedChallan(challan);
                    amount = challan.total();
                } else {
                    amount = inventory.post(challan);
                    challans.save(challan);
                }
                audit("CHALLAN_POST", challan.getNumber());
                model.setRowCount(0);
                total.setText("Total Amount: 0.00");
                challanNumber.setText(nextChallanNumber(title)); challanDate.setText(todayIso()); party.setSelectedIndex(0); location.getEditor().setItem("");
                status.setText("  " + title + " " + challan.getNumber() + " posted; " + lines.size() + " line(s), total " + amount.toPlainString());
            } catch (NumberFormatException error) {
                status.setText("  Challan quantities and rates must be numbers");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot post " + title + ": " + error.getMessage());
            }
        });
        buttons.add(addLine);
        buttons.add(removeLine);
        buttons.add(post);
        JButton print = actionButton("Print Challan", "Challan print requested");
        print.addActionListener(e -> printChallan(title, challanNumber, challanDate, party, location, model));
        buttons.add(print);
        buttons.add(total);
        tablePanel.add(buttons, BorderLayout.SOUTH);
        addFormAndTable(panel, header, tablePanel);
        return panel;
    }

    private BigDecimal challanTotal(DefaultTableModel model) {
        BigDecimal total = BigDecimal.ZERO;
        for (int row = 0; row < model.getRowCount(); row++) {
            Object amount = model.getValueAt(row, 5);
            if (amount == null || String.valueOf(amount).trim().isEmpty()) continue;
            try { total = total.add(new BigDecimal(String.valueOf(amount))); }
            catch (NumberFormatException ignored) { }
        }
        return total;
    }

    private void printChallan(String title, JTextField number, JTextField date, JComboBox<String> party, JComboBox<String> location, DefaultTableModel model) {
        DefaultTableModel printable = new DefaultTableModel(new Object[0][6], new String[] {"Item Code", "Description", "Unit", "Quantity", "Rate", "Amount"});
        for (int row = 0; row < model.getRowCount(); row++) {
            printable.addRow(new Object[] {model.getValueAt(row, 0), model.getValueAt(row, 1), model.getValueAt(row, 2), model.getValueAt(row, 3), model.getValueAt(row, 4), model.getValueAt(row, 5)});
        }
        JTable document = new JTable(printable);
        document.setAutoResizeMode(JTable.AUTO_RESIZE_ALL_COLUMNS);
        printStructuredTable(document, title + "   Number: " + number.getText() + "   Date: " + date.getText()
                + "   Party: " + selectedAccountCode(party.getSelectedItem()) + "   Location: " + selectedText(location));
    }

    private void printVoucher(String title, JTextField[] headerFields, DefaultTableModel model) {
        DefaultTableModel printable = new DefaultTableModel(new Object[0][4], new String[] {"Account", "Description", "Debit", "Credit"});
        for (int row = 0; row < model.getRowCount(); row++) {
            printable.addRow(new Object[] {model.getValueAt(row, 0), model.getValueAt(row, 1), model.getValueAt(row, 2), model.getValueAt(row, 3)});
        }
        JTable document = new JTable(printable);
        document.setAutoResizeMode(JTable.AUTO_RESIZE_ALL_COLUMNS);
        printStructuredTable(document, title + "   Number: " + headerFields[0].getText() + "   Date: " + headerFields[1].getText()
                + "   Narration: " + headerFields[2].getText() + "   Reference: " + headerFields[3].getText());
    }

    private void printStructuredTable(JTable table, String title) {
        printHtmlDocument(title, table);
    }

    private JPanel searchPaymentScreen() {
        JPanel panel = page("Search Payment");
        JPanel form = inlineTitled("Search Payment");
        inlineField(form, "From Date", 10);
        inlineField(form, "To Date", 10);
        JComboBox<String> account = accountSelector();
        form.add(new JLabel("Account")); form.add(account);
        inlineField(form, "Cheque Number", 10);
        inlineField(form, "Amount", 10);
        form.add(actionButton("Search Payments", "Payment search completed"));
        addFormAndTable(panel, form, table(new String[] {"Voucher Date", "Voucher Number", "Account", "Account Description", "Amount", "Status"}, null));
        return panel;
    }

    private JPanel paymentReceiptScreen() {
        JPanel panel = page("Payment / Receipt");
        JPanel form = titled("Payment or Receipt Entry");
        JComboBox<String> type = new JComboBox<String>(new String[] {"PAYMENT", "RECEIPT"});
        JTextField number = new JTextField(20);
        number.setText(nextVoucherNumber());
        lockGeneratedId(number);
        JTextField date = fieldForLabel("Payment Date", 12, true);
        JComboBox<String> cashAccount = accountSelector();
        JComboBox<String> partyAccount = accountSelector();
        JTextField amount = new JTextField(12);
        JTextField narration = new JTextField(30);
        addGrid(form, new JLabel("Entry Type"), 0, 0, 1, 1, 0, 0); addGrid(form, type, 1, 0, 1, 1, 1, 0);
        addGrid(form, new JLabel("Voucher Number"), 0, 1, 1, 1, 0, 0); addGrid(form, number, 1, 1, 1, 1, 1, 0);
        addGrid(form, new JLabel("Date (yyyy-MM-dd)"), 0, 2, 1, 1, 0, 0); addGrid(form, date, 1, 2, 1, 1, 0, 0); addGrid(form, calendarButton(date), 2, 2, 1, 1, 0, 0);
        addGrid(form, new JLabel("Cash / Bank Account"), 0, 3, 1, 1, 0, 0); addGrid(form, cashAccount, 1, 3, 1, 1, 1, 0);
        addGrid(form, new JLabel("Party"), 0, 4, 1, 1, 0, 0); addGrid(form, partyAccount, 1, 4, 1, 1, 1, 0);
        addGrid(form, new JLabel("Amount"), 0, 5, 1, 1, 0, 0); addGrid(form, amount, 1, 5, 1, 1, 1, 0);
        addGrid(form, new JLabel("Narration"), 0, 6, 1, 1, 0, 0); addGrid(form, narration, 1, 6, 1, 1, 1, 0);
        JButton post = actionButton("Post Payment / Receipt", "Payment or receipt posted");
        post.addActionListener(e -> {
            try {
                if (number.getText().trim().isEmpty()) number.setText(nextVoucherNumber());
                if (date.getText().trim().isEmpty()) date.setText(todayIso());
                String cash = selectedAccountCode(cashAccount.getSelectedItem());
                String party = selectedAccountCode(partyAccount.getSelectedItem());
                BigDecimal value = new BigDecimal(amount.getText().trim());
                if (cash.equals(party)) throw new IllegalArgumentException("Cash/bank and party accounts must be different");
                JournalVoucher journal = new JournalVoucher();
                if ("PAYMENT".equals(type.getSelectedItem())) { journal.add(party, value, BigDecimal.ZERO); journal.add(cash, BigDecimal.ZERO, value); }
                else { journal.add(cash, value, BigDecimal.ZERO); journal.add(party, BigDecimal.ZERO, value); }
                PostedVoucher posted = new PostedVoucher(number.getText(), date.getText(), narration.getText(), String.valueOf(type.getSelectedItem()), journal);
                vouchers.save(posted);
                audit("" + type.getSelectedItem() + "_POST", posted.getNumber());
                status.setText("  " + type.getSelectedItem() + " " + posted.getNumber() + " posted");
                number.setText(""); amount.setText(""); narration.setText("");
            } catch (NumberFormatException error) { status.setText("  Payment amount must be a number"); }
            catch (IllegalArgumentException error) { status.setText("  Cannot post payment/receipt: " + error.getMessage()); }
        });
        addGrid(form, post, 0, 7, 2, 1, 1, 0);
        addScrollable(panel, form);
        return panel;
    }

    private JComboBox<String> accountSelector() {
        JComboBox<String> selector = new JComboBox<String>();
        accountSelectors.add(selector);
        fillAccountSelector(selector);
        return selector;
    }

    /** Party select input derived from the chart of accounts (the Main Account tree). */
    private JComboBox<String> partySelector() {
        JComboBox<String> selector = new JComboBox<String>();
        partySelectors.add(selector);
        fillPartySelector(selector);
        return selector;
    }

    private JComboBox<String> itemSelector() {
        JComboBox<String> selector = new JComboBox<String>();
        itemSelectors.add(selector);
        fillItemSelector(selector);
        return selector;
    }

    private void fillAccountSelector(JComboBox<String> selector) {
        Object selected = selector.getSelectedItem();
        selector.removeAllItems();
        for (Account account : accounts.findAll()) selector.addItem(account.getCode() + " - " + account.getDescription());
        if (selected != null) selector.setSelectedItem(selected);
    }

    private void fillPartySelector(JComboBox<String> selector) {
        Object selected = selector.getSelectedItem();
        selector.removeAllItems();
        Map<String, Account> byCode = new LinkedHashMap<String, Account>();
        for (Account account : accounts.findAll()) byCode.put(account.getCode(), account);
        for (Account account : accounts.findAll()) {
            boolean cashInHand = "Cash in Hand".equalsIgnoreCase(account.getDescription());
            boolean underParty = false;
            Account ancestor = account;
            Set<String> visited = new LinkedHashSet<String>();
            while (ancestor != null && ancestor.getParentCode() != null && visited.add(ancestor.getCode())) {
                ancestor = byCode.get(ancestor.getParentCode());
                if (ancestor != null && "Party".equalsIgnoreCase(ancestor.getDescription())) {
                    underParty = !account.getCode().equals(ancestor.getCode());
                    break;
                }
            }
            if (cashInHand || underParty) selector.addItem(account.getCode() + " - " + account.getDescription());
        }
        if (selected != null) selector.setSelectedItem(selected);
    }

    private void fillItemSelector(JComboBox<String> selector) {
        Object selected = selector.getSelectedItem();
        selector.removeAllItems();
        selector.addItem("(select item)");
        for (Item item : items.findAll()) selector.addItem(item.getCode() + " - " + item.getDescription());
        if (selected != null) selector.setSelectedItem(selected);
    }

    private void refreshLinkedSelectors() {
        for (JComboBox<String> selector : accountSelectors) fillAccountSelector(selector);
        for (JComboBox<String> selector : partySelectors) fillPartySelector(selector);
        for (JComboBox<String> selector : itemSelectors) fillItemSelector(selector);
        for (JComboBox<String> selector : stockTypeSelectors) fillStockTypeSelector(selector);
        for (JComboBox<String> selector : locationSelectors) fillLocationSelector(selector);
        refreshBankSelector();
    }

    private String selectedAccountCode(Object value) {
        if (value == null) return "";
        String text = String.valueOf(value);
        int separator = text.indexOf(" - ");
        return separator < 0 ? text.trim() : text.substring(0, separator).trim();
    }

    private String selectedItemCode(Object value) {
        if (value == null || String.valueOf(value).startsWith("(select item)")) return "";
        String text = String.valueOf(value);
        int separator = text.indexOf(" - ");
        return separator < 0 ? text.trim() : text.substring(0, separator).trim();
    }

    private JComboBox<String> stockTypeSelector() {
        JComboBox<String> selector = new JComboBox<String>();
        stockTypeSelectors.add(selector);
        fillStockTypeSelector(selector);
        return selector;
    }

    private void fillStockTypeSelector(JComboBox<String> selector) {
        Object selected = selector.getSelectedItem();
        selector.removeAllItems();
        for (Map.Entry<String, String> entry : stockTypes.entrySet()) selector.addItem(entry.getKey() + " - " + entry.getValue());
        for (Item item : items.findAll()) {
            boolean present = false;
            for (int i = 0; i < selector.getItemCount(); i++) if (selectedStockType(selector.getItemAt(i)).equals(item.getStockType())) present = true;
            if (!present && !stockTypes.containsKey(item.getStockType())) selector.addItem(item.getStockType() + " - Existing item type");
        }
        if (selected != null) selector.setSelectedItem(selected);
    }

    private void refreshStockTypeSelectors() {
        for (JComboBox<String> selector : stockTypeSelectors) fillStockTypeSelector(selector);
    }

    private void selectStockType(JComboBox<String> selector, String code) {
        for (int i = 0; i < selector.getItemCount(); i++) {
            if (code.equals(selectedStockType(selector.getItemAt(i)))) {
                selector.setSelectedIndex(i);
                return;
            }
        }
    }

    private JComboBox<String> locationSelector(boolean allowNew) {
        JComboBox<String> selector = new JComboBox<String>();
        selector.setEditable(allowNew);
        locationSelectors.add(selector);
        fillLocationSelector(selector);
        return selector;
    }

    private void fillLocationSelector(JComboBox<String> selector) {
        Object selected = selector.isEditable() ? selector.getEditor().getItem() : selector.getSelectedItem();
        selector.removeAllItems();
        for (com.purchasesale.domain.StockMovement movement : inventory.movements()) {
            String location = movement.getLocation();
            boolean exists = false;
            for (int i = 0; i < selector.getItemCount(); i++) if (location.equals(selector.getItemAt(i))) exists = true;
            if (!exists) selector.addItem(location);
        }
        if (selected != null) selector.setSelectedItem(selected);
    }

    private String selectedText(JComboBox<String> selector) {
        Object value = selector.isEditable() ? selector.getEditor().getItem() : selector.getSelectedItem();
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String selectedStockType(Object value) {
        if (value == null) return "REG";
        String text = String.valueOf(value);
        int separator = text.indexOf(" - ");
        return separator < 0 ? text.trim() : text.substring(0, separator).trim();
    }

    private JPanel transferScreen() {
        JPanel panel = page("Transfer");
        JPanel body = new JPanel(new GridLayout(2, 1, 8, 8));
        JPanel from = inlineTitled("From Location");
        JComboBox<String> transferItem = itemSelector();
        from.add(new JLabel("Item Code")); from.add(transferItem);
        JComboBox<String> fromLocation = locationSelector(true);
        from.add(new JLabel("From Location")); from.add(fromLocation);
        JTextField available = inlineField(from, "Available Quantity", 10);
        JButton getQuantity = new OfficeButton("Get Quantity");
        getQuantity.addActionListener(e -> {
            try {
                available.setText(inventory.stock(selectedItemCode(transferItem.getSelectedItem()), selectedText(fromLocation)).toPlainString());
                status.setText("  Available quantity loaded");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot load quantity: " + error.getMessage());
            }
        });
        from.add(getQuantity);
        JPanel to = inlineTitled("To Location");
        JComboBox<String> toLocation = locationSelector(true);
        to.add(new JLabel("To Location")); to.add(toLocation);
        JTextField transferQuantity = inlineField(to, "Transfer Quantity", 10);
        JButton transfer = new OfficeButton("Transfer Quantity");
        transfer.addActionListener(e -> {
            try {
                String selectedCode = selectedItemCode(transferItem.getSelectedItem());
                inventory.transfer(selectedCode, selectedText(fromLocation), selectedText(toLocation), new BigDecimal(transferQuantity.getText().trim()));
                available.setText(inventory.stock(selectedCode, selectedText(fromLocation)).toPlainString());
                status.setText("  Stock transfer saved to " + storageName());
            } catch (NumberFormatException error) {
                status.setText("  Transfer quantity must be a number");
            } catch (IllegalArgumentException error) {
                status.setText("  Cannot transfer stock: " + error.getMessage());
            }
        });
        to.add(transfer);
        body.add(from); body.add(to);
        addScrollable(panel, body);
        return panel;
    }

    private JPanel userRightsScreen() {
        JPanel panel = page("User Rights");
        JPanel form = titled("User Account");
        JTextField username = new JTextField(30);
        JPasswordField password = new JPasswordField(30);
        addGrid(form, new JLabel("User Name"), 0, 0, 1, 1, 0, 0); addGrid(form, username, 1, 0, 1, 1, 1, 0);
        addGrid(form, new JLabel("Password (leave blank to keep current)"), 0, 1, 1, 1, 0, 0); addGrid(form, password, 1, 1, 1, 1, 1, 0);
        JPanel permissions = new JPanel(new GridLayout(0, 3, 6, 6));
        permissions.setBorder(BorderFactory.createTitledBorder("Permissions"));
        String[] names = USER_PERMISSIONS;
        final Map<String, JCheckBox> checks = new LinkedHashMap<String, JCheckBox>();
        for (String name : names) { JCheckBox check = new JCheckBox(name); checks.put(name, check); permissions.add(check); }
        addGrid(form, permissions, 0, 2, 2, 1, 1, 0);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][2], new String[] {"User Name", "Permissions"});
        final String[] selectedUser = new String[1];
        JButton newUser = actionButton("New User", "New user entry");
        newUser.addActionListener(e -> {
            selectedUser[0] = null;
            username.setText(""); password.setText("");
            for (JCheckBox check : checks.values()) check.setSelected(false);
            username.requestFocusInWindow();
        });
        JButton save = actionButton("Save User", "User saved to " + storageName());
        save.addActionListener(e -> {
            try {
                String name = username.getText().trim();
                if (name.isEmpty()) throw new IllegalArgumentException("User name is required");
                char[] passwordChars = password.getPassword();
                String passwordHash;
                if (passwordChars.length == 0) {
                    UserAccount existing = findUser(name);
                    if (existing == null) throw new IllegalArgumentException("Password is required for a new user");
                    passwordHash = existing.getPasswordHash();
                } else {
                    passwordHash = passwordHash(new String(passwordChars));
                }
                Set<String> selected = new LinkedHashSet<String>();
                for (Map.Entry<String, JCheckBox> entry : checks.entrySet()) if (entry.getValue().isSelected()) selected.add(entry.getKey());
                users.save(new UserAccount(name, passwordHash, selected));
                audit("USER_SAVE", name);
                loadUsers(model);
                status.setText("  User " + name + " saved to " + storageName());
                password.setText("");
            } catch (Exception error) { status.setText("  Cannot save user: " + error.getMessage()); }
        });
        JButton delete = actionButton("Delete User", "User deleted");
        delete.addActionListener(e -> {
            String name = username.getText().trim();
            if (name.isEmpty()) { status.setText("  Select a user before deleting"); return; }
            if (activeUser != null && activeUser.getUsername().equalsIgnoreCase(name)) { status.setText("  You cannot delete your own account"); return; }
            if (!confirmDelete("user", name)) return;
            try {
                users.delete(name);
                audit("USER_DELETE", name);
                loadUsers(model);
                if (selectedUser[0] != null && selectedUser[0].equalsIgnoreCase(name)) {
                    selectedUser[0] = null; username.setText(""); password.setText("");
                    for (JCheckBox check : checks.values()) check.setSelected(false);
                }
                status.setText("  User " + name + " deleted");
            } catch (Exception error) { status.setText("  Cannot delete user: " + error.getMessage()); }
        });
        JPanel buttons = buttonBar(); buttons.add(newUser); buttons.add(save); buttons.add(delete);
        addGrid(form, buttons, 0, 3, 2, 1, 1, 0);

        final JTable table = new JTable(model);
        table.setRowHeight(26);
        table.getSelectionModel().addListSelectionListener(e -> {
            if (e.getValueIsAdjusting()) return;
            int row = table.getSelectedRow();
            if (row < 0) return;
            String name = String.valueOf(model.getValueAt(row, 0));
            selectedUser[0] = name;
            for (UserAccount user : users.findAll()) {
                if (user.getUsername().equals(name)) {
                    username.setText(user.getUsername());
                    password.setText("");
                    for (Map.Entry<String, JCheckBox> entry : checks.entrySet()) entry.getValue().setSelected(user.getPermissions().contains(entry.getKey()));
                    break;
                }
            }
        });
        JButton refreshUsers = actionButton("Refresh Users", "User list refreshed");
        refreshUsers.addActionListener(e -> loadUsers(model));
        JPanel tablePanel = new JPanel(new BorderLayout());
        tablePanel.add(new JScrollPane(table), BorderLayout.CENTER);
        JPanel tableButtons = buttonBar(); tableButtons.add(refreshUsers);
        tablePanel.add(tableButtons, BorderLayout.SOUTH);
        addFormAndTable(panel, form, tablePanel);
        loadUsers(model);
        return panel;
    }

    private void loadUsers(DefaultTableModel model) {
        model.setRowCount(0);
        for (UserAccount user : users.findAll()) model.addRow(new Object[] {user.getUsername(), String.join(", ", user.getPermissions())});
    }

    private UserAccount findUser(String username) {
        for (UserAccount user : users.findAll()) if (user.getUsername().equalsIgnoreCase(username)) return user;
        return null;
    }

    private String passwordHash(String password) throws Exception {
        if (password == null || password.isEmpty()) throw new IllegalArgumentException("Password is required");
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        byte[] derived = derivePassword(password, salt, 120000);
        return "pbkdf2$120000$" + Base64.getEncoder().encodeToString(salt) + "$" + Base64.getEncoder().encodeToString(derived);
    }

    private boolean passwordMatches(String password, String stored) {
        if (password == null || stored == null) return false;
        try {
            if (stored.startsWith("pbkdf2$")) {
                String[] parts = stored.split("\\$", -1);
                if (parts.length != 4) return false;
                int iterations = Integer.parseInt(parts[1]);
                byte[] salt = Base64.getDecoder().decode(parts[2]);
                byte[] expected = Base64.getDecoder().decode(parts[3]);
                return MessageDigest.isEqual(expected, derivePassword(password, salt, iterations));
            }
            byte[] legacy = MessageDigest.getInstance("SHA-256").digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte value : legacy) result.append(String.format("%02x", value & 0xff));
            return MessageDigest.isEqual(result.toString().getBytes(StandardCharsets.UTF_8), stored.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) { return false; }
    }

    private byte[] derivePassword(String password, byte[] salt, int iterations) throws Exception {
        KeySpec specification = new PBEKeySpec(password.toCharArray(), salt, iterations, 256);
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(specification).getEncoded();
    }

    private String storageName() { return databasePath == null ? "demo memory" : "SQLite"; }

    private void audit(String action, String details) {
        String username = activeUser == null ? "system" : activeUser.getUsername();
        String[] row = {new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()), username, action, details == null ? "" : details};
        if (persistence instanceof SQLiteOfficeData) {
            try { ((SQLiteOfficeData) persistence).recordAudit(username, action, details); }
            catch (Exception ignored) { status.setText("  Warning: audit event could not be recorded"); }
        } else {
            auditEvents.add(row);
        }
    }

    private JPanel auditScreen() {
        JPanel panel = page("Audit Log");
        DefaultTableModel model = new DefaultTableModel(new Object[0][4], new String[] {"Time", "User", "Action", "Details"});
        JTable table = new JTable(model);
        JButton refresh = actionButton("Refresh Audit Log", "Audit log refreshed");
        refresh.addActionListener(e -> loadAudit(model));
        JLabel hint = new JLabel("<html>Audit events are recorded for saves, edits, deletions, postings, backups, and exports.<br>SQLite production mode keeps them in the database; demo mode keeps them in memory for this session.</html>");
        hint.setFont(new Font("Dialog", Font.PLAIN, 12));
        hint.setForeground(new Color(100, 110, 120));
        JPanel header = new JPanel(new BorderLayout(8, 8)); header.add(refresh, BorderLayout.WEST); header.add(hint, BorderLayout.EAST);
        JPanel body = new JPanel(new BorderLayout()); body.add(header, BorderLayout.NORTH); body.add(new JScrollPane(table), BorderLayout.CENTER);
        addScrollable(panel, body);
        loadAudit(model);
        return panel;
    }

    private void loadAudit(DefaultTableModel model) {
        model.setRowCount(0);
        try {
            if (persistence instanceof SQLiteOfficeData) {
                for (String[] row : ((SQLiteOfficeData) persistence).auditEvents()) model.addRow(row);
            } else {
                for (String[] row : auditEvents) model.addRow(row);
            }
        } catch (Exception error) { status.setText("  Cannot load audit log: " + error.getMessage()); }
    }

    private JPanel reportScreen(String title) {
        JPanel panel = page(title);
        JPanel filters = inlineTitled("Report Filters");
        JTextField fromDate = inlineField(filters, "From Date", 10);
        JTextField toDate = inlineField(filters, "To Date", 10);
        inlineField(filters, "Company", 10);
        JComboBox<String> location = locationSelector(true);
        filters.add(new JLabel("Location")); filters.add(location);
        JComboBox<String> itemCode = itemSelector();
        filters.add(new JLabel("Item Code")); filters.add(itemCode);
        final DefaultTableModel model = new DefaultTableModel(new Object[0][reportColumns(title).length], reportColumns(title));
        final JTable output = new JTable(model);
        output.setRowHeight(26);
        JButton preview = new OfficeButton("Preview Report");
        preview.addActionListener(e -> {
            model.setRowCount(0);
            int count = populateReport(title, model, fromDate.getText(), toDate.getText(), selectedText(location), selectedItemCode(itemCode.getSelectedItem()));
            status.setText("  " + title + ": " + count + " row(s)");
        });
        filters.add(preview);
        JButton print = actionButton("Print Report", title + " sent to printer");
        print.addActionListener(e -> printTable(output, title));
        filters.add(print);
        JButton export = actionButton("Export Report", title + " export is ready");
        export.addActionListener(e -> exportTable(output, title));
        filters.add(export);
        addFormAndTable(panel, filters, new JScrollPane(output));
        return panel;
    }

    private void exportTable(JTable table, String title) {
        JFileChooser chooser = new JFileChooser();
        chooser.setDialogTitle("Export " + title);
        chooser.setFileFilter(new FileNameExtensionFilter("CSV files (*.csv)", "csv"));
        String safeName = title.replaceAll("[^A-Za-z0-9]+", "-").replaceAll("^-|-$", "").toLowerCase();
        chooser.setSelectedFile(new java.io.File(safeName + ".csv"));
        if (chooser.showSaveDialog(cards) != JFileChooser.APPROVE_OPTION) return;

        java.io.File file = chooser.getSelectedFile();
        if (!file.getName().toLowerCase().endsWith(".csv")) file = new java.io.File(file.getAbsolutePath() + ".csv");
        try (BufferedWriter writer = Files.newBufferedWriter(file.toPath(), StandardCharsets.UTF_8)) {
            for (int column = 0; column < table.getColumnCount(); column++) {
                if (column > 0) writer.write(',');
                writer.write(csvCell(table.getColumnName(column)));
            }
            writer.newLine();
            for (int row = 0; row < table.getRowCount(); row++) {
                for (int column = 0; column < table.getColumnCount(); column++) {
                    if (column > 0) writer.write(',');
                    writer.write(csvCell(table.getValueAt(row, column)));
                }
                writer.newLine();
            }
            status.setText("  CSV exported: " + file.getName());
        } catch (Exception error) {
            status.setText("  Export failed: " + error.getMessage());
        }
    }

    private void printTable(JTable table, String title) {
        printHtmlDocument(title + "   Printed: " + clockText(), table);
    }

    private void printHtmlDocument(String title, JTable table) {
        JTextPane document = new JTextPane();
        document.setContentType("text/html");
        document.setEditable(false);
        StringBuilder html = new StringBuilder("<html><body style='font-family: sans-serif; font-size: 10pt;'>");
        html.append(companyLogoHtml());
        html.append("<h1>").append(htmlEscape(companyProfile.load().getName())).append("</h1>");
        html.append("<h2>").append(htmlEscape(title)).append("</h2>");
        html.append("<table border='1' cellspacing='0' cellpadding='5' width='100%'><tr>");
        for (int column = 0; column < table.getColumnCount(); column++) html.append("<th>").append(htmlEscape(table.getColumnName(column))).append("</th>");
        html.append("</tr>");
        for (int row = 0; row < table.getRowCount(); row++) {
            html.append("<tr>");
            for (int column = 0; column < table.getColumnCount(); column++) html.append("<td>").append(htmlEscape(table.getValueAt(row, column))).append("</td>");
            html.append("</tr>");
        }
        html.append("</table><br><small>Printed: ").append(htmlEscape(clockText())).append("</small></body></html>");
        document.setText(html.toString());
        try {
            boolean printed = document.print(null, null, true, null, null, true);
            status.setText(printed ? "  Print completed: " + title : "  Print cancelled: " + title);
        } catch (Exception error) { status.setText("  Print failed: " + error.getMessage()); }
    }

    private String companyLogoHtml() {
        String path = companyProfile.load().getLogoPath();
        if (path == null || path.trim().isEmpty()) return "";
        try {
            Path logo = Paths.get(path);
            if (!Files.isRegularFile(logo)) return "";
            return "<p><img src=\"" + htmlEscape(logo.toAbsolutePath().toUri().toString()) + "\" width=\"120\"></p>";
        } catch (Exception ignored) { return ""; }
    }

    private String htmlEscape(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private String csvCell(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    private int populateReport(String title, DefaultTableModel model, String fromDate, String toDate, String location, String itemCode) {
        int count = 0;
        if ("Company Profitability Report".equals(title) || "Item Profitability Report".equals(title) || "PC Profit Report".equals(title)) {
            Map<String, BigDecimal[]> totals = new LinkedHashMap<String, BigDecimal[]>();
            for (Challan challan : challans.findAll()) {
                if (!matchesFilters(challan.getDate(), challan.getLocation(), fromDate, toDate, location)) continue;
                for (Challan.Line line : challan.getLines()) {
                    if (!matchesItem(line.getItemCode(), itemCode)) continue;
                    String key = "Company Profitability Report".equals(title) ? challan.getDate()
                            : "Item Profitability Report".equals(title) ? line.getItemCode()
                            : challan.getDate() + "\u001f" + challan.getParty();
                    BigDecimal[] values = totals.get(key);
                    if (values == null) { values = new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO}; totals.put(key, values); }
                    if (challan.getType() == Challan.Type.PURCHASE) values[0] = values[0].add(line.amount());
                    else values[1] = values[1].add(line.amount());
                }
            }
            for (Map.Entry<String, BigDecimal[]> entry : totals.entrySet()) {
                BigDecimal purchase = entry.getValue()[0];
                BigDecimal sale = entry.getValue()[1];
                BigDecimal profit = sale.subtract(purchase);
                BigDecimal margin = sale.signum() == 0 ? BigDecimal.ZERO : profit.multiply(new BigDecimal("100")).divide(sale, 2, RoundingMode.HALF_UP);
                if ("Company Profitability Report".equals(title)) model.addRow(new Object[] {entry.getKey(), purchase, sale, profit, margin});
                else if ("Item Profitability Report".equals(title)) model.addRow(new Object[] {entry.getKey(), purchase, sale, profit, margin});
                else { int separator = entry.getKey().indexOf('\u001f'); model.addRow(new Object[] {entry.getKey().substring(0, separator), entry.getKey().substring(separator + 1), purchase, sale, profit, margin}); }
                count++;
            }
            return count;
        }
        if ("Post Dated Cheques".equals(title) || "Returned Cheques".equals(title) || "OS Cheques".equals(title)) {
            String today = new SimpleDateFormat("yyyy-MM-dd").format(new Date());
            for (Cheque cheque : cheques.findAll()) {
                if (!matchesDate(cheque.getDate(), fromDate, toDate)) continue;
                if ("Post Dated Cheques".equals(title) && !("PENDING".equalsIgnoreCase(cheque.getStatus()) && cheque.getDate().compareTo(today) > 0)) continue;
                if ("Returned Cheques".equals(title) && !"RETURNED".equalsIgnoreCase(cheque.getStatus())) continue;
                if ("OS Cheques".equals(title) && !("PENDING".equalsIgnoreCase(cheque.getStatus()) && cheque.getDate().compareTo(today) <= 0)) continue;
                if ("OS Cheques".equals(title)) {
                    model.addRow(new Object[] {cheque.getNumber(), cheque.getDate(), cheque.getParty(), cheque.getBankCode(), cheque.getAmount(), daysOutstanding(cheque.getDate(), today)});
                } else if ("Returned Cheques".equals(title)) {
                    model.addRow(new Object[] {cheque.getNumber(), cheque.getDate(), cheque.getParty(), cheque.getBankCode(), cheque.getAmount(), cheque.getStatus()});
                } else {
                    model.addRow(new Object[] {cheque.getNumber(), cheque.getBankCode(), cheque.getDate(), cheque.getParty(), cheque.getAmount(), cheque.getStatus()});
                }
                count++;
            }
            return count;
        }
        if ("Purchase Report Date Wise".equals(title) || "Purchase Register".equals(title)
                || "Sales Register".equals(title)) {
            boolean purchase = !"Sales Register".equals(title);
            for (Challan challan : challans.findAll()) {
                if ((challan.getType() == Challan.Type.PURCHASE) != purchase) continue;
                if (!matchesFilters(challan.getDate(), challan.getLocation(), fromDate, toDate, location)) continue;
                for (Challan.Line line : challan.getLines()) {
                    if (!matchesItem(line.getItemCode(), itemCode)) continue;
                    if ("Purchase Report Date Wise".equals(title)) {
                        model.addRow(new Object[] {challan.getDate(), challan.getNumber(), challan.getParty(), line.getItemCode(), line.getQuantity(), line.amount()});
                    } else {
                        model.addRow(new Object[] {challan.getDate(), challan.getNumber(), challan.getParty(), 1, line.amount()});
                    }
                    count++;
                }
            }
            return count;
        }
        if ("Stock Summary".equals(title)) {
            Map<String, BigDecimal[]> summary = new LinkedHashMap<String, BigDecimal[]>();
            for (com.purchasesale.domain.StockMovement movement : inventory.movements()) {
                if (!matchesFilters(movement.getDate(), movement.getLocation(), fromDate, toDate, location) || !matchesItem(movement.getItemCode(), itemCode)) continue;
                String key = movement.getItemCode() + "\u001f" + movement.getLocation();
                BigDecimal[] values = summary.get(key);
                if (values == null) { values = new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO}; summary.put(key, values); }
                if (movement.getQuantity().signum() > 0) values[1] = values[1].add(movement.getQuantity());
                if (movement.getQuantity().signum() < 0) values[2] = values[2].add(movement.getQuantity().abs());
            }
            for (Map.Entry<String, BigDecimal[]> entry : summary.entrySet()) {
                int separator = entry.getKey().indexOf('\u001f');
                String item = entry.getKey().substring(0, separator);
                String locationValue = entry.getKey().substring(separator + 1);
                BigDecimal[] values = entry.getValue();
                model.addRow(new Object[] {item, locationValue, values[0], values[1], values[2], inventory.stock(item, locationValue)});
                count++;
            }
            return count;
        }
        if ("Stock Report Date Wise".equals(title) || "Stock Report Item Wise".equals(title)
                || "Stock Ledger".equals(title) || "Item Ledger".equals(title) || "Transit".equals(title)) {
            for (com.purchasesale.domain.StockMovement movement : inventory.movements()) {
                if (!matchesFilters(movement.getDate(), movement.getLocation(), fromDate, toDate, location) || !matchesItem(movement.getItemCode(), itemCode)) continue;
                BigDecimal in = movement.getQuantity().signum() > 0 ? movement.getQuantity() : BigDecimal.ZERO;
                BigDecimal out = movement.getQuantity().signum() < 0 ? movement.getQuantity().abs() : BigDecimal.ZERO;
                if ("Transit".equals(title)) {
                    model.addRow(new Object[] {movement.getDate(), movement.getDocument(), movement.getItemCode(), movement.getLocation(), movement.getQuantity(), movement.getType()});
                } else if ("Stock Ledger".equals(title) || "Item Ledger".equals(title)) {
                    model.addRow(new Object[] {movement.getDate(), movement.getDocument(), movement.getItemCode(), movement.getLocation(), in, out, inventory.stock(movement.getItemCode(), movement.getLocation())});
                } else if ("Stock Report Item Wise".equals(title)) {
                    model.addRow(new Object[] {movement.getItemCode(), movement.getDate(), movement.getLocation(), in, out, inventory.stock(movement.getItemCode(), movement.getLocation())});
                } else {
                    model.addRow(new Object[] {movement.getDate(), movement.getItemCode(), movement.getLocation(), in, out, inventory.stock(movement.getItemCode(), movement.getLocation())});
                }
                count++;
            }
            return count;
        }
        if ("Voucher".equals(title) || "Journal Voucher".equals(title) || "General Ledger".equals(title)) {
            for (PostedVoucher voucher : vouchers.findAll()) {
                if (!matchesDate(voucher.getDate(), fromDate, toDate)) continue;
                for (JournalVoucher.JournalLine line : voucher.lines()) {
                    if (!matchesItem(line.getAccountCode(), itemCode)) continue;
                    if ("General Ledger".equals(title)) {
                        model.addRow(new Object[] {voucher.getDate(), voucher.getNumber(), voucher.getReference(), line.getAccountCode(), line.getDebit(), line.getCredit(), line.getDebit().subtract(line.getCredit())});
                    } else {
                        model.addRow(new Object[] {voucher.getDate(), voucher.getNumber(), line.getAccountCode(), line.getDebit(), line.getCredit()});
                    }
                    count++;
                }
            }
        }
        return count;
    }

    private boolean matchesDate(String date, String fromDate, String toDate) {
        String value = date == null ? "" : date.trim();
        String from = fromDate == null ? "" : fromDate.trim();
        String to = toDate == null ? "" : toDate.trim();
        return (from.isEmpty() || value.compareTo(from) >= 0) && (to.isEmpty() || value.compareTo(to) <= 0);
    }

    private boolean matchesFilters(String date, String movementLocation, String fromDate, String toDate, String location) {
        String requestedLocation = location == null ? "" : location.trim();
        return matchesDate(date, fromDate, toDate) && (requestedLocation.isEmpty() || requestedLocation.equalsIgnoreCase(movementLocation));
    }

    private boolean matchesItem(String value, String requested) {
        String filter = requested == null ? "" : requested.trim();
        return filter.isEmpty() || filter.equalsIgnoreCase(value);
    }

    private long daysOutstanding(String chequeDate, String today) {
        try { return Math.max(0, LocalDate.parse(today).toEpochDay() - LocalDate.parse(chequeDate).toEpochDay()); }
        catch (Exception ignored) { return 0; }
    }

    private String[] reportColumns(String title) {
        if ("Transit".equals(title)) return new String[] {"Date", "Document", "Item", "Location", "Quantity", "Movement"};
        if ("Ledger".equals(title)) return new String[] {"Date", "Voucher Number", "Account", "Particulars", "Debit", "Credit", "Balance"};
        if ("Purchase Report Date Wise".equals(title)) return new String[] {"Date", "Challan Number", "Supplier", "Item", "Quantity", "Amount"};
        if ("Trial Balance Date Wise".equals(title)) return new String[] {"Date", "Account", "Debit", "Credit", "Balance"};
        if ("Stock Report Date Wise".equals(title)) return new String[] {"Date", "Item", "Location", "Quantity In", "Quantity Out", "Balance"};
        if ("Stock Report Item Wise".equals(title)) return new String[] {"Item", "Date", "Location", "Quantity In", "Quantity Out", "Balance"};
        if ("Post Dated Cheques".equals(title)) return new String[] {"Cheque Number", "Cheque Date", "Party", "Bank", "Amount", "Status"};
        if ("Returned Cheques".equals(title)) return new String[] {"Cheque Number", "Return Date", "Party", "Bank", "Amount", "Reason"};
        if ("Aging Report".equals(title)) return new String[] {"Party", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total"};
        if ("Receivable".equals(title)) return new String[] {"Party", "Invoice", "Invoice Date", "Due Date", "Amount", "Received", "Balance"};
        if ("Item Ledger".equals(title)) return new String[] {"Date", "Document", "Item", "Location", "Quantity In", "Quantity Out", "Balance"};
        if ("Party Item Detail".equals(title)) return new String[] {"Party", "Item", "Date", "Document", "Quantity", "Rate", "Amount"};
        if ("PC Profit Report".equals(title)) return new String[] {"Date", "Party", "Purchase", "Sale", "Gross Profit", "Margin"};
        if ("Company Profitability Report".equals(title)) return new String[] {"Date", "Purchase", "Sale", "Gross Profit", "Margin"};
        if ("Item Profitability Report".equals(title)) return new String[] {"Item", "Purchase", "Sale", "Gross Profit", "Margin"};
        if ("Type Wise Item Report".equals(title)) return new String[] {"Stock Type", "Item", "Quantity", "Value", "Average Rate"};
        if ("OS Cheques".equals(title)) return new String[] {"Cheque Number", "Cheque Date", "Party", "Bank", "Amount", "Days Outstanding"};
        if ("Party Activity Report".equals(title)) return new String[] {"Date", "Party", "Activity", "Reference", "Debit", "Credit", "Balance"};
        if ("Trial Balance".equals(title)) return new String[] {"Account", "Debit", "Credit", "Balance"};
        if ("General Ledger".equals(title)) return new String[] {"Date", "Voucher Number", "Reference", "Description", "Debit", "Credit", "Balance"};
        if ("Balance Sheet".equals(title)) return new String[] {"Account", "Assets", "Liabilities", "Equity"};
        if ("Profit & Loss".equals(title)) return new String[] {"Account", "Income", "Expense", "Net Profit"};
        if ("Stock Ledger".equals(title)) return new String[] {"Date", "Document", "Item", "Location", "Quantity In", "Quantity Out", "Balance"};
        if ("Stock Summary".equals(title)) return new String[] {"Item", "Location", "Opening", "Purchased", "Sold", "Balance"};
        if ("Party Ledger".equals(title)) return new String[] {"Date", "Document", "Party", "Particulars", "Debit", "Credit", "Balance"};
        if ("Purchase Register".equals(title)) return new String[] {"Date", "Challan Number", "Supplier", "Items", "Amount"};
        if ("Sales Register".equals(title)) return new String[] {"Date", "Challan Number", "Customer", "Items", "Amount"};
        if ("Receivables".equals(title)) return new String[] {"Party", "Document", "Due Date", "Amount", "Received", "Balance"};
        if ("Payables".equals(title)) return new String[] {"Supplier", "Document", "Due Date", "Amount", "Paid", "Balance"};
        if ("Cash Book".equals(title)) return new String[] {"Date", "Voucher", "Particulars", "Receipt", "Payment", "Balance"};
        if ("Bank Book".equals(title)) return new String[] {"Date", "Bank", "Cheque Number", "Particulars", "Deposit", "Withdrawal", "Balance"};
        if ("Voucher".equals(title) || "Journal Voucher".equals(title)) return new String[] {"Voucher Date", "Voucher Number", "Account Code", "Debit", "Credit"};
        return new String[] {"Date", "Document", "Description", "Quantity", "Amount"};
    }

    private JPanel table(String[] columns, Object[][] rows) {
        Object[][] safeRows = rows == null ? new Object[0][columns.length] : rows;
        final DefaultTableModel model = new DefaultTableModel(safeRows, columns);
        final JTable table = new JTable(model);
        table.setRowHeight(26);
        JPanel panel = new JPanel(new BorderLayout());
        panel.add(new JScrollPane(table), BorderLayout.CENTER);
        JPanel buttons = buttonBar();
        JButton newRow = new OfficeButton("Add Row");
        newRow.addActionListener(e -> {
            model.addRow(new Object[columns.length]);
            int lastRow = model.getRowCount() - 1;
            table.setRowSelectionInterval(lastRow, lastRow);
            status.setText("  New row added; enter values in the table");
        });
        JButton delete = new OfficeButton("Delete Row");
        delete.addActionListener(e -> {
            int row = table.getSelectedRow();
            if (row < 0) {
                status.setText("  Select a row before deleting");
                return;
            }
            model.removeRow(row);
            status.setText("  Row deleted from " + storageName());
        });
        JButton save = new OfficeButton("Save Table");
        save.addActionListener(e -> {
            if (model.getRowCount() == 0) {
                status.setText("  Nothing to save");
                return;
            }
            status.setText("  " + model.getRowCount() + " row(s) saved to " + storageName());
        });
        JButton clear = new OfficeButton("Clear Table");
        clear.addActionListener(e -> {
            model.setRowCount(0);
            status.setText("  Table cleared");
        });
        buttons.add(newRow); buttons.add(delete); buttons.add(save); buttons.add(clear);
        panel.add(buttons, BorderLayout.SOUTH);
        return panel;
    }

    private JPanel page(String title) {
        JPanel page = new JPanel(new BorderLayout(12, 12));
        page.setBorder(BorderFactory.createEmptyBorder(14, 14, 14, 14));
        JLabel heading = new JLabel(title);
        heading.setFont(new Font("Dialog", Font.BOLD, 24));
        heading.setForeground(new Color(40, 65, 85));
        page.add(heading, BorderLayout.NORTH);
        return page;
    }

    private JPanel titled(String title) {
        JPanel panel = new JPanel(new GridBagLayout());
        panel.setBorder(BorderFactory.createTitledBorder(title));
        return panel;
    }

    private JPanel inlineTitled(String title) {
        JPanel panel = new JPanel(new WrappingFlowLayout(FlowLayout.LEFT, 10, 10));
        panel.setBorder(BorderFactory.createTitledBorder(title));
        return panel;
    }

    private JPanel buttonBar() {
        JPanel panel = new JPanel(new WrappingFlowLayout(FlowLayout.LEFT, 8, 6));
        panel.setBorder(BorderFactory.createEmptyBorder(2, 0, 2, 0));
        return panel;
    }

    private void addFormAndTable(JPanel page, JPanel form, java.awt.Component table) {
        JScrollPane formScroll = new JScrollPane(form);
        formScroll.setBorder(null);
        formScroll.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
        formScroll.setVerticalScrollBarPolicy(JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED);
        int formHeight = Math.max(250, Math.min(360, form.getPreferredSize().height + 28));
        formScroll.setPreferredSize(new Dimension(0, formHeight));
        JSplitPane split = new JSplitPane(JSplitPane.VERTICAL_SPLIT, formScroll, table);
        split.setResizeWeight(0.45);
        split.setDividerLocation(formHeight);
        split.setOneTouchExpandable(true);
        split.setContinuousLayout(true);
        split.setMinimumSize(new Dimension(0, 0));
        page.add(split, BorderLayout.CENTER);
    }

    private void addScrollable(JPanel page, JPanel body) {
        JScrollPane scroll = new JScrollPane(body);
        scroll.setBorder(null);
        page.add(scroll, BorderLayout.CENTER);
    }

    private JTextField[] addFields(JPanel panel, String[] labels) {
        JTextField[] fields = new JTextField[labels.length];
        for (int i = 0; i < labels.length; i++) {
            addGrid(panel, new JLabel(labels[i]), 0, i, 1, 1, 0, 0);
            fields[i] = fieldForLabel(labels[i], 20, true);
            addGrid(panel, fields[i], 1, i, 1, 1, 1, 0);
            if (isDateLabel(labels[i])) addGrid(panel, calendarButton(fields[i]), 2, i, 1, 1, 0, 0);
        }
        return fields;
    }

    private JTextField[] addEditableFields(JPanel panel, String[] labels) {
        JTextField[] fields = new JTextField[labels.length];
        for (int i = 0; i < labels.length; i++) {
            fields[i] = fieldForLabel(labels[i], 20, false);
            addGrid(panel, new JLabel(labels[i]), 0, i, 1, 1, 0, 0);
            addGrid(panel, fields[i], 1, i, 1, 1, 1, 0);
            if (isDateLabel(labels[i])) addGrid(panel, calendarButton(fields[i]), 2, i, 1, 1, 0, 0);
        }
        return fields;
    }

    private void addInlineFields(JPanel panel, String[] labels) {
        for (String label : labels) {
            panel.add(new JLabel(label));
            JTextField field = fieldForLabel(label, 12, false);
            panel.add(field);
            if (isDateLabel(label)) panel.add(calendarButton(field));
        }
    }

    private JTextField inlineField(JPanel panel, String label, int columns) {
        panel.add(new JLabel(label));
        JTextField field = fieldForLabel(label, columns, false);
        panel.add(field);
        if (isDateLabel(label)) panel.add(calendarButton(field));
        return field;
    }

    private JTextField fieldForLabel(String label, int columns, boolean defaultToday) {
        JTextField field = new JTextField(columns);
        if (label.toLowerCase().contains("date")) {
            field.setToolTipText("Enter date as yyyy-MM-dd");
            if (defaultToday) field.setText(todayIso());
        }
        return field;
    }

    private String todayIso() {
        return new SimpleDateFormat("yyyy-MM-dd").format(new Date());
    }

    private boolean isDateLabel(String label) {
        return label != null && label.toLowerCase().contains("date");
    }

    private JButton calendarButton(final JTextField field) {
        JButton button = new JButton("...");
        button.setToolTipText("Choose date");
        button.setMargin(new Insets(2, 5, 2, 5));
        button.setFocusable(false);
        button.addActionListener(e -> showDatePicker(field, button));
        return button;
    }

    private void showDatePicker(final JTextField field, final JButton owner) {
        final JPopupMenu popup = new JPopupMenu();
        final Calendar shown = Calendar.getInstance();
        try {
            Date parsed = new SimpleDateFormat("yyyy-MM-dd").parse(field.getText().trim());
            shown.setTime(parsed);
        } catch (Exception ignored) { }
        final JPanel body = new JPanel(new BorderLayout(4, 4));
        final JLabel month = new JLabel("", JLabel.CENTER);
        final JPanel days = new JPanel(new GridLayout(0, 7, 2, 2));
        JPanel header = new JPanel(new BorderLayout());
        JButton previous = new JButton("<");
        JButton next = new JButton(">");
        previous.setMargin(new Insets(2, 6, 2, 6));
        next.setMargin(new Insets(2, 6, 2, 6));
        header.add(previous, BorderLayout.WEST); header.add(month, BorderLayout.CENTER); header.add(next, BorderLayout.EAST);
        body.add(header, BorderLayout.NORTH); body.add(days, BorderLayout.CENTER);
        popup.add(body);
        Runnable refresh = new Runnable() {
            @Override public void run() {
                month.setText(new SimpleDateFormat("MMMM yyyy").format(shown.getTime()));
                days.removeAll();
                String[] names = {"Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"};
                for (String name : names) days.add(new JLabel(name, JLabel.CENTER));
                Calendar first = (Calendar) shown.clone();
                first.set(Calendar.DAY_OF_MONTH, 1);
                int mondayFirst = first.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY;
                if (mondayFirst < 0) mondayFirst += 7;
                for (int i = 0; i < mondayFirst; i++) days.add(new JLabel(""));
                int count = shown.getActualMaximum(Calendar.DAY_OF_MONTH);
                for (int day = 1; day <= count; day++) {
                    final int chosenDay = day;
                    JButton dayButton = new JButton(String.valueOf(day));
                    dayButton.setMargin(new Insets(2, 3, 2, 3));
                    dayButton.addActionListener(e -> {
                        Calendar chosen = (Calendar) shown.clone();
                        chosen.set(Calendar.DAY_OF_MONTH, chosenDay);
                        field.setText(new SimpleDateFormat("yyyy-MM-dd").format(chosen.getTime()));
                        popup.setVisible(false);
                    });
                    days.add(dayButton);
                }
                days.revalidate(); days.repaint();
            }
        };
        previous.addActionListener(e -> { shown.add(Calendar.MONTH, -1); refresh.run(); });
        next.addActionListener(e -> { shown.add(Calendar.MONTH, 1); refresh.run(); });
        refresh.run();
        popup.show(owner, 0, owner.getHeight());
    }

    private BigDecimal decimalOrZero(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? BigDecimal.ZERO : new BigDecimal(trimmed);
    }

    private void addGrid(JPanel panel, java.awt.Component component, int x, int y, int width, int height, double weightx, double weighty) {
        GridBagConstraints c = new GridBagConstraints();
        c.gridx = x; c.gridy = y; c.gridwidth = width; c.gridheight = height;
        // Keep ordinary data-entry fields at their preferred width. Stretching
        // every field to the full viewport made the forms look like web pages.
        c.weightx = weightx == 1 ? 0 : weightx; c.weighty = weighty; c.fill = GridBagConstraints.HORIZONTAL;
        c.anchor = GridBagConstraints.WEST; c.insets = new Insets(5, 7, 5, 7);
        panel.add(component, c);
    }

    private JButton actionButton(String label, final String result) {
        JButton button = new OfficeButton(label);
        button.addActionListener(e -> status.setText("  " + result));
        return button;
    }

    private JButton goButton(String label, final String screen) {
        JButton button = new OfficeButton(label);
        button.addActionListener(e -> showScreen(screen));
        return button;
    }

    /**
     * Action button that paints its own blue background instead of relying on
     * the platform button UI. The system Windows look and feel ignores button
     * backgrounds, which made these buttons nearly invisible on Windows while
     * they looked fine on Debian. A custom paint keeps them clear everywhere.
     */
    private static final class OfficeButton extends JButton {
        private static final Color BASE = new Color(31, 105, 165);
        private OfficeButton(String label) {
            super(label);
            setFocusPainted(false);
            setOpaque(false);
            setContentAreaFilled(false);
            setBorderPainted(false);
            setForeground(Color.WHITE);
            setBorder(BorderFactory.createEmptyBorder(6, 11, 6, 11));
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            Color background;
            if (!isEnabled()) background = new Color(140, 150, 160);
            else if (getModel().isPressed()) background = darker(BASE);
            else if (getModel().isRollover()) background = lighter(BASE);
            else background = BASE;
            g2.setColor(background);
            g2.fillRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            g2.setColor(new Color(18, 58, 91));
            g2.drawRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            g2.dispose();
            setForeground(isEnabled() ? Color.WHITE : new Color(225, 229, 233));
            super.paintComponent(g);
        }

        private static Color darker(Color color) { return new Color(Math.max(0, color.getRed() - 25), Math.max(0, color.getGreen() - 25), Math.max(0, color.getBlue() - 25)); }
        private static Color lighter(Color color) { return new Color(Math.min(255, color.getRed() + 25), Math.min(255, color.getGreen() + 25), Math.min(255, color.getBlue() + 25)); }
    }

    private void lockGeneratedId(JTextField field) {
        field.setEditable(false);
        field.setBackground(new Color(238, 242, 246));
        field.setToolTipText("Generated automatically");
    }

    /** A FlowLayout that reports its real wrapped height to parent panels. */
    private static final class WrappingFlowLayout extends FlowLayout {
        private WrappingFlowLayout(int alignment) { super(alignment); }
        private WrappingFlowLayout(int alignment, int hgap, int vgap) { super(alignment, hgap, vgap); }

        @Override public Dimension preferredLayoutSize(java.awt.Container parent) {
            return layoutSize(parent, false);
        }

        @Override public Dimension minimumLayoutSize(java.awt.Container parent) {
            return layoutSize(parent, true);
        }

        private Dimension layoutSize(java.awt.Container parent, boolean minimum) {
            synchronized (parent.getTreeLock()) {
                java.awt.Insets insets = parent.getInsets();
                // Use a conservative fallback before the first real layout so
                // narrow windows reserve height for a wrapped second row.
                int available = parent.getWidth() > 0 ? parent.getWidth() - insets.left - insets.right : 480;
                int rowWidth = 0;
                int rowHeight = 0;
                int totalHeight = 0;
                int rows = 1;
                for (java.awt.Component component : parent.getComponents()) {
                    if (!component.isVisible()) continue;
                    Dimension size = minimum ? component.getMinimumSize() : component.getPreferredSize();
                    int needed = rowWidth == 0 ? size.width : rowWidth + getHgap() + size.width;
                    if (rowWidth > 0 && needed > available) {
                        totalHeight += rowHeight + getVgap();
                        rows++;
                        rowWidth = size.width;
                        rowHeight = size.height;
                    } else {
                        rowWidth = needed;
                        rowHeight = Math.max(rowHeight, size.height);
                    }
                }
                totalHeight += rowHeight;
                // FlowLayout reserves a vertical gap above and below its rows.
                // Omitting those gaps clips the bottom edge of buttons when the
                // bar is placed in a GridBag cell at the bottom of a form.
                return new Dimension(insets.left + insets.right + Math.min(available, 640),
                        insets.top + insets.bottom + totalHeight + (getVgap() * 2));
            }
        }
    }

    private JPanel helpScreen() {
        JPanel panel = page("User Manual");
        JTabbedPane tabs = new JTabbedPane();
        tabs.addTab("Overview", manualText(
                "PURCHASE-SALE-OFFICE(1)\n\n" +
                "NAME\n    Purchase Sale Office - desktop purchase, sale, stock, and accounting workspace.\n\n" +
                "SYNOPSIS\n    Start on Home, configure master data, record transactions, then run reports.\n\n" +
                "DESCRIPTION\n    This application manages accounts, items, stock, purchases, sales, vouchers, banks, and reports.\n" +
                "    It starts empty so test data is deliberate and easy to remove.\n\n" +
                "QUICK START\n" +
                "    1. Masters > Chart of Account: create Assets and Cash. Select Assets as Cash's parent.\n" +
                "    2. Masters > Items: create an item with code, unit, and rates.\n" +
                "    3. Transactions > Item Opening Balances: enter starting quantity and rate.\n" +
                "    4. Use Record Purchase or Record Sale from Home.\n" +
                "    5. Files > Company Profile: enter the office name and contact details.\n" +
                "    6. Open a report and choose Preview Report or Export Report.\n\n" +
                "END-OF-DAY\n    Preview the reports needed by the office, close open documents, and use Files > Backup for the SQLite database.\n\n" +
                "STATE\n    Debian scripts run the clean in-memory demo. The Windows handover launcher selects SQLite mode; records survive restart only when the JDBC driver is installed and startup succeeds."));
        tabs.addTab("Accounts", manualText(
                "CHART-OF-ACCOUNT(1)\n\n" +
                "PURPOSE\n    Defines the account hierarchy used by vouchers and financial reports.\n\n" +
                "FIELDS\n    Account Code       Unique code, for example 1 or 1101.\n" +
                "    Account Description Human-readable account name.\n" +
                "    Parent Account    Select Top-level account for a root account, or an existing account for a child.\n" +
                "    Remaining fields  Opening balance, account type, contact, and tax details.\n\n" +
                "WORKFLOW\n    To create a root: choose Add Top-Level Account, fill code and description, then Save.\n" +
                "    To create a child: select its parent in the tree or click Add Subaccount, fill the form, then Save.\n" +
                "    To edit: select an account in the tree, change its fields, then choose Update Account.\n" +
                "    To remove: select an account and choose Delete Account. Accounts with children cannot be removed.\n" +
                "    Choose New Account before entering a separate record. The tree displays children beneath their parent.\n\n" +
                "ERRORS\n    Duplicate account codes are rejected by the repository. A selected parent must already exist.\n\n" +
                "CODE CONFLICTS\n    Re-entering the same code with the same name and parent is treated as a duplicate and ignored.\n" +
                "    Re-entering a code with different details is saved under the next available numeric code, starting one higher than the requested code. For example, a conflict on 1101 tries 1102, then 1103. Check the status message and review the chart.\n\n" +
                "EXAMPLE\n    1 Assets (root) -> 11 Cash (child) -> 1101 Cash in Hand (grandchild)."));
        tabs.addTab("Inventory", manualText(
                "ITEMS-AND-STOCK(1)\n\n" +
                "ITEMS\n    Create an item before using it in a challan. Item Code is the value used by stock operations.\n" +
                "    Sale Rate and Purchase Rate are used as the fixed rates on their respective challans.\n\n" +
                "MAINTENANCE\n    Select a row to load it into the form. Use Update Item to save changes or Delete Item to remove it from the current database mode. Choose New Item before entering a new item.\n\n" +
                "OPENING BALANCE\n    Choose Item Code and Location, enter Opening Quantity, and save. Opening Rate is copied from the item's Purchase Rate.\n\n" +
                "PURCHASE\n    Post Challan increases stock at the selected location. Unknown item codes are rejected.\n\n" +
                "SALE\n    Post Challan decreases stock. A sale greater than available stock is rejected.\n\n" +
                "TRANSFER\n    Enter Item Code and From Location, choose Get Quantity, then enter To Location and Transfer Quantity.\n" +
                "    The source must have enough stock; source and destination should be different locations.\n\n" +
                "LOCATIONS\n    Existing choices come from locations recorded on stock movements. The Location field is editable, so enter a new location when needed.\n\n" +
                "TIP\n    Use one consistent spelling for locations; locations are treated as separate stock buckets."));
        tabs.addTab("Transactions", manualText(
                "TRANSACTIONS(1)\n\n" +
                "VOUCHER\n    Add Voucher Line for each debit or credit. Use Validate Voucher before posting.\n" +
                "    A balanced voucher has total debits equal to total credits.\n\n" +
                "PURCHASE / SALE CHALLAN\n    Set the date, party, and location. Use Add Item Row, then choose an item and enter its quantity in the table; add as many rows as needed.\n" +
                "    The rate is copied from the item's Purchase Rate or Sale Rate and is read-only. Review the total, then choose Post Challan.\n" +
                "    Party choices are accounts below the Chart of Accounts parent named Party, plus Cash in Hand.\n\n" +
                "BANK AND CHEQUES\n    Create banks under Masters > Bank. They then appear in Cheque Detail.\n" +
                "    Enter check voucher number, check number, bank, date, party, amount, and status, then choose Save Cheque. Party choices are filtered to Party descendants and Cash in Hand. Search Cheques filters saved records by number and bank. View Status History shows saved status changes; bank reconciliation is not implemented yet.\n\n" +
                "PAYMENTS\n    Search Payments provides date, account, cheque number, and amount filters for the future payment ledger.\n\n" +
                "PAYMENT / RECEIPT\n    Transactions > Payment / Receipt posts a balanced voucher. Payment debits the party and credits cash/bank; Receipt debits cash/bank and credits the party. Confirm the office’s account mapping before treating these entries as official.\n\n" +
                "USER RIGHTS\n    On the first SQLite launch, create an administrator. Later launches require a saved user name and password. The screen lists all saved users: select one to edit its password or permissions, use New User to start a fresh record, or Delete User to remove one (you cannot delete your own account). Passwords use salted PBKDF2 hashing; older SHA-256 records upgrade after a successful login. Menus, quick actions, and screen navigation enforce the saved permissions after login."));
        tabs.addTab("Reports", manualText(
                "REPORTS(1)\n\n" +
                "COMMON OPTIONS\n    Enter dates as yyyy-MM-dd. From Date, To Date, Location, and Item Code filter the implemented challan, stock, and voucher reports. Company is reserved for the future multi-company accounting rule.\n" +
                "    Use Preview Report to refresh the result table, Print Report to request printing, and Export Report to request export.\n\n" +
                "REPORT GROUPS\n    Financial: Ledger, Trial Balance, General Ledger, Balance Sheet, Profit & Loss, Cash Book, Bank Book.\n" +
                "    Stock: Stock Ledger, Stock Summary, Stock Report Date Wise, Stock Report Item Wise, Item Ledger.\n" +
                "    Parties: Party Ledger, Receivables, Payables, Aging Report, Receivable, Party Activity Report.\n" +
                "    Sales and purchase: Purchase Register, Sales Register, Purchase Report Date Wise, profitability reports.\n" +
                "    Cheques: Post Dated Cheques, Returned Cheques, OS Cheques.\n\n" +
                "CURRENT RESULT\n    Empty results are expected until the relevant data is saved. Stock, purchase/sales, voucher, and ledger previews use implemented repositories; several specialized reports remain display scaffolding until their business rules are confirmed."));
        tabs.addTab("Toolbar", manualText(
                "TOOLBAR(1)\n\n" +
                "New Record       Starts a new record mode.\n" +
                "Save / Commit    Confirms the current demo action. Screen-specific buttons are more precise.\n" +
                "Delete Selected  Requests deletion of the selected record or row.\n" +
                "First / Previous / Next / Last  Legacy record-navigation commands.\n" +
                "Search           Opens search mode for the current screen.\n" +
                "Refresh          Rebuilds the current screen from its repository.\n" +
                "Print / Preview  Requests a print preview.\n" +
                "Help             Opens this manual.\n" +
                "Exit             Closes the application.\n\n" +
                "The toolbar icons have tooltips; hover over an icon if its symbol is unfamiliar."));
        tabs.addTab("Administration", manualText(
                "ADMINISTRATION(1)\n\n" +
                "BACKUP\n    Choose Files > Backup. The application creates a dated copy automatically in the backups folder. No file picker is needed. Choose Files > Export Data to write readable CSV files for accounts, items, banks, challans, and vouchers.\n" +
                "    A backup is a complete snapshot. To restore one, close the application, copy the chosen snapshot over data\\purchase-sale.sqlite, then start the application. Keep the old file until the restored data is checked.\n\n" +
                "MULTIPLE USERS\n    SQLite is one local office database, not a multi-user server. Use one authoritative office PC and make backups from that PC. Do not let two PCs open separate copies and expect the app to merge them.\n" +
                "    If several people must enter data simultaneously, the next production revision needs a server database or a controlled import/export workflow.\n\n" +
                "HANDOVER\n    Before distributing this legacy build, test it on the target Windows computer. Close and reopen the app to confirm records remain. If records disappear, do not use it for office data.\n\n" +
                "DATABASE\n    The planned database file is SQLite. It does not require a database server and is appropriate for one Windows workstation.\n" +
                "    Keep the file in a writable data folder. Do not edit the same file from several computers on a network share.\n\n" +
                "USER RIGHTS\n    The first SQLite launch creates an administrator. Later launches require login. User Rights stores permissions and screen navigation enforces them. New passwords use salted PBKDF2 hashing; older SHA-256 records are upgraded after a successful login. Audit Log records important saves, edits, deletions, postings, backups, and exports.\n\n" +
                "CLEAN START\n    The demo repositories start empty. Create master data before entering transactions. Never use test records in the production database."));
        tabs.addTab("Troubleshooting", manualText(
                "TROUBLESHOOTING(1)\n\n" +
                "NOTHING APPEARS\n    Confirm the correct menu item is open and click Refresh. A clean installation intentionally has no rows.\n\n" +
                "SALE REJECTED\n    Confirm the item exists, the location is spelled correctly, and available quantity is sufficient.\n\n" +
                "VOUCHER REJECTED\n    Add at least one line and make total Debit equal total Credit.\n\n" +
                "BANK NOT IN CHEQUE LIST\n    Save the bank first, then revisit Cheque Detail or click Refresh.\n\n" +
                "WAYLAND / SWAY\n    Run through scripts/run.sh. It sets the Java/XWayland compatibility option when a Wayland session has DISPLAY available.\n\n" +
                "SQLITE DATABASE\n    SQLite is the durable database for this desktop application. Keep the database in a writable data folder, not inside Program Files. Files > Backup safely creates a dated snapshot while the app is running.\n\n" +
                "SYNCHRONIZATION\n    One local SQLite file is safe for a single workstation or light use. Do not have several computers edit the same file on a network share. Multi-computer use needs an explicit import/export process or a server database.\n\n" +
                "LIMITATIONS\n    Screenshots do not reveal the original tax rules, permissions model, or synchronization policy. The current program uses sensible defaults; SQLite persistence is available only in the explicit production startup mode and still requires integration testing."));
        panel.add(tabs, BorderLayout.CENTER);
        return panel;
    }

    private JScrollPane manualText(String text) {
        JTextArea area = new JTextArea(text);
        area.setEditable(false);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        area.setFont(new Font("Dialog", Font.PLAIN, 14));
        area.setBorder(BorderFactory.createEmptyBorder(16, 18, 16, 18));
        return new JScrollPane(area);
    }

    private void backup(JFrame owner) {
        if (!isAllowed("Backup")) {
            status.setText("  Access denied: Backup");
            return;
        }
        if (databasePath == null || !(persistence instanceof SQLiteOfficeData)) {
            status.setText("  Backup is available in SQLite production mode only");
            return;
        }
        try {
            Path appRoot = databasePath.getParent() == null ? Paths.get(".").toAbsolutePath()
                    : databasePath.getParent().getParent();
            Path backupDirectory = appRoot.resolve("backups");
            Files.createDirectories(backupDirectory);
            String timestamp = new SimpleDateFormat("yyyyMMdd-HHmmssSSS").format(new Date());
            Path target = backupDirectory.resolve("purchase-sale-" + timestamp + ".sqlite");
            ((SQLiteOfficeData) persistence).backupTo(target);
            audit("BACKUP", target.toString());
            status.setText("  Backup created: backups\\" + target.getFileName());
        } catch (Exception error) {
            status.setText("  Backup failed: " + error.getMessage());
        }
    }

    private void exportData(JFrame owner) {
        if (!isAllowed("Backup")) {
            status.setText("  Access denied: Export Data");
            return;
        }
        JFileChooser chooser = new JFileChooser();
        chooser.setDialogTitle("Choose folder for exported data");
        chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
        if (chooser.showSaveDialog(owner) != JFileChooser.APPROVE_OPTION) return;
        java.io.File folder = chooser.getSelectedFile();
        try {
            writeCsvFile(folder.toPath().resolve("accounts.csv"), new String[] {"Account Code", "Description", "Parent Code"}, accountRows());
            writeCsvFile(folder.toPath().resolve("items.csv"), new String[] {"Item Code", "Description", "Unit", "Sale Rate", "Purchase Rate", "Stock Type"}, itemRows());
            writeCsvFile(folder.toPath().resolve("banks.csv"), new String[] {"Bank Code", "Bank Name", "Account Number", "Opening Balance", "Address", "Phone"}, bankRows());
            writeCsvFile(folder.toPath().resolve("challans.csv"), new String[] {"Type", "Number", "Date", "Party", "Location", "Item Code", "Quantity", "Rate", "Amount"}, challanRows());
            writeCsvFile(folder.toPath().resolve("vouchers.csv"), new String[] {"Number", "Date", "Narration", "Reference", "Account Code", "Debit", "Credit"}, voucherRows());
            audit("DATA_EXPORT", folder.getAbsolutePath());
            status.setText("  Data exported to: " + folder.getName());
        } catch (Exception error) {
            status.setText("  Data export failed: " + error.getMessage());
        }
    }

    private void verifyDatabase() {
        if (!(persistence instanceof SQLiteOfficeData)) {
            status.setText("  Database verification is available in SQLite production mode only");
            return;
        }
        try {
            String result = ((SQLiteOfficeData) persistence).integrityCheck();
            boolean healthy = "ok".equalsIgnoreCase(result);
            status.setText("  SQLite integrity check: " + result);
            JOptionPane.showMessageDialog(cards, healthy ? "Database integrity check passed." : "Database check reported:\n" + result, "Database verification", healthy ? JOptionPane.INFORMATION_MESSAGE : JOptionPane.WARNING_MESSAGE);
        } catch (Exception error) {
            status.setText("  Database verification failed: " + error.getMessage());
        }
    }

    private List<Object[]> accountRows() {
        List<Object[]> rows = new ArrayList<Object[]>();
        for (Account value : accounts.findAll()) rows.add(new Object[] {value.getCode(), value.getDescription(), value.getParentCode()});
        return rows;
    }

    private List<Object[]> itemRows() {
        List<Object[]> rows = new ArrayList<Object[]>();
        for (Item value : items.findAll()) rows.add(new Object[] {value.getCode(), value.getDescription(), value.getUnit(), value.getSaleRate(), value.getPurchaseRate(), value.getStockType()});
        return rows;
    }

    private List<Object[]> bankRows() {
        List<Object[]> rows = new ArrayList<Object[]>();
        for (Bank value : banks.findAll()) rows.add(new Object[] {value.getCode(), value.getName(), value.getAccountNumber(), value.getOpeningBalance(), value.getAddress(), value.getPhone()});
        return rows;
    }

    private List<Object[]> challanRows() {
        List<Object[]> rows = new ArrayList<Object[]>();
        for (Challan value : challans.findAll()) for (Challan.Line line : value.getLines()) rows.add(new Object[] {value.getType(), value.getNumber(), value.getDate(), value.getParty(), value.getLocation(), line.getItemCode(), line.getQuantity(), line.getRate(), line.amount()});
        return rows;
    }

    private List<Object[]> voucherRows() {
        List<Object[]> rows = new ArrayList<Object[]>();
        for (PostedVoucher value : vouchers.findAll()) for (JournalVoucher.JournalLine line : value.lines()) rows.add(new Object[] {value.getNumber(), value.getDate(), value.getNarration(), value.getReference(), line.getAccountCode(), line.getDebit(), line.getCredit()});
        return rows;
    }

    private void writeCsvFile(Path file, String[] headers, List<Object[]> rows) throws IOException {
        try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8)) {
            for (int column = 0; column < headers.length; column++) { if (column > 0) writer.write(','); writer.write(csvCell(headers[column])); }
            writer.newLine();
            for (Object[] row : rows) { for (int column = 0; column < row.length; column++) { if (column > 0) writer.write(','); writer.write(csvCell(row[column])); } writer.newLine(); }
        }
    }

    private void message(String text) {
        JOptionPane.showMessageDialog(cards, text, "Demo mode", JOptionPane.INFORMATION_MESSAGE);
    }
}
