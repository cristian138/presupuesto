import requests
import sys
from datetime import datetime, timedelta
import json

class BudgetControlAPITester:
    def __init__(self, base_url="https://audit-pay-track.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, auth=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True, f"Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {"raw_response": response.text}
            else:
                error_detail = ""
                try:
                    error_data = response.json()
                    error_detail = f"- {error_data.get('detail', 'Unknown error')}"
                except:
                    error_detail = f"- Raw: {response.text[:100]}"
                
                self.log_test(name, False, f"Expected {expected_status}, got {response.status_code} {error_detail}")
                return False, {}

        except requests.exceptions.RequestException as e:
            self.log_test(name, False, f"Network error: {str(e)}")
            return False, {}
        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration (should become super_admin for first user)"""
        test_email = f"admin{datetime.now().strftime('%H%M%S')}@test.com"
        user_data = {
            "email": test_email,
            "password": "admin123",
            "full_name": "Admin Test User",
            "phone": "+57 300 123 4567",
            "role": "accountant"  # Should become super_admin automatically
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data,
            auth=False
        )
        
        if success:
            self.token = response.get('access_token')
            user = response.get('user', {})
            self.user_id = user.get('id')
            
            # Check if first user became super_admin
            if user.get('role') == 'super_admin':
                self.log_test("First User Auto Super Admin", True, "Role correctly set to super_admin")
            else:
                self.log_test("First User Auto Super Admin", False, f"Role is {user.get('role')}, expected super_admin")
        
        return success

    def test_user_login(self):
        """Test user login with registered credentials"""
        login_data = {
            "email": "admin@test.com",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data=login_data,
            auth=False
        )
        
        if success:
            self.token = response.get('access_token')
            self.user_id = response.get('user', {}).get('id')
            
        return success

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_budget_creation(self):
        """Test budget creation with monthly periods auto-generation"""
        if not self.user_id:
            self.log_test("Budget Creation", False, "No user_id available")
            return False
            
        start_date = datetime.now().strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        
        budget_data = {
            "expense_type": "fijo",
            "concept": "Test Budget - Office Rent",
            "monthly_value": 2500000.0,
            "periodicity": "mensual",
            "total_months": 12,
            "start_date": start_date,
            "end_date": end_date,
            "responsible_id": self.user_id,
            "responsible_name": "Admin Test User",
            "status": "activo",
            "notes": "Test budget for automated testing"
        }
        
        success, response = self.run_test(
            "Budget Creation",
            "POST",
            "budgets",
            200,
            data=budget_data
        )
        
        if success:
            self.test_data['budget_id'] = response.get('id')
            monthly_periods = response.get('monthly_periods', 0)
            
            if monthly_periods == 12:
                self.log_test("Monthly Periods Generation", True, f"Generated {monthly_periods} periods")
            else:
                self.log_test("Monthly Periods Generation", False, f"Expected 12, got {monthly_periods}")
        
        return success

    def test_budget_list(self):
        """Test listing budgets"""
        success, response = self.run_test(
            "List Budgets",
            "GET",
            "budgets",
            200
        )
        
        if success and isinstance(response, list):
            budget_count = len(response)
            self.log_test("Budget List Count", budget_count > 0, f"Found {budget_count} budgets")
        
        return success

    def test_monthly_budgets_list(self):
        """Test listing monthly budgets with filters"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        success, response = self.run_test(
            "List Monthly Budgets",
            "GET", 
            f"monthly-budgets?month={current_month}&year={current_year}",
            200
        )
        
        if success:
            self.test_data['monthly_budgets'] = response
            if response and len(response) > 0:
                self.test_data['monthly_budget_id'] = response[0].get('id')
                
        return success

    def test_payment_registration(self):
        """Test payment registration with PDF generation"""
        monthly_budget_id = self.test_data.get('monthly_budget_id')
        if not monthly_budget_id:
            self.log_test("Payment Registration", False, "No monthly budget ID available")
            return False
            
        payment_data = {
            "monthly_budget_id": monthly_budget_id,
            "payment_date": datetime.now().strftime('%Y-%m-%d'),
            "paid_value": 2500000.0,
            "payment_method": "transferencia",
            "observations": "Test payment via API"
        }
        
        success, response = self.run_test(
            "Payment Registration",
            "POST",
            "payments",
            200,
            data=payment_data
        )
        
        if success:
            self.test_data['payment_id'] = response.get('id')
            verification_code = response.get('verification_code')
            pdf_url = response.get('pdf_url')
            
            if verification_code:
                self.log_test("Payment Verification Code", True, f"Code: {verification_code[:10]}...")
            else:
                self.log_test("Payment Verification Code", False, "No verification code generated")
                
            if pdf_url and pdf_url.startswith('data:application/pdf'):
                self.log_test("PDF Generation", True, "PDF generated successfully")
            else:
                self.log_test("PDF Generation", False, "PDF not generated or invalid")
        
        return success

    def test_dashboard_kpi(self):
        """Test dashboard KPI endpoint"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        success, response = self.run_test(
            "Dashboard KPI",
            "GET",
            f"dashboard/kpi?month={current_month}&year={current_year}",
            200
        )
        
        if success:
            expected_fields = ['total_budgeted', 'total_executed', 'execution_percentage', 'pending_count']
            missing_fields = [f for f in expected_fields if f not in response]
            
            if not missing_fields:
                self.log_test("Dashboard KPI Fields", True, "All required fields present")
            else:
                self.log_test("Dashboard KPI Fields", False, f"Missing fields: {missing_fields}")
        
        return success

    def test_monthly_summary(self):
        """Test monthly summary endpoint"""
        current_year = datetime.now().year
        
        success, response = self.run_test(
            "Monthly Summary",
            "GET",
            f"dashboard/monthly-summary?year={current_year}",
            200
        )
        
        if success and isinstance(response, list):
            self.log_test("Monthly Summary Format", True, f"Got {len(response)} months of data")
        
        return success

    def test_user_management(self):
        """Test user management endpoints (admin only)"""
        success, response = self.run_test(
            "List Users (Admin)",
            "GET",
            "users",
            200
        )
        return success

    def test_audit_logs(self):
        """Test audit log viewing (admin only)"""
        success, response = self.run_test(
            "Audit Logs",
            "GET",
            "audit-logs?limit=10",
            200
        )
        
        if success and isinstance(response, list):
            self.log_test("Audit Log Entries", True, f"Found {len(response)} audit entries")
        
        return success

    def test_notification_config(self):
        """Test notification configuration endpoints"""
        # Get config
        success, response = self.run_test(
            "Get Notification Config",
            "GET",
            "notification-config",
            200
        )
        
        if success:
            # Update config
            update_data = {
                "email_enabled": True,
                "notify_on_creation": True,
                "days_before_due": 3
            }
            
            update_success, _ = self.run_test(
                "Update Notification Config",
                "PUT",
                "notification-config",
                200,
                data=update_data
            )
            
            return update_success
        
        return success

    def test_reports(self):
        """Test report generation endpoints"""
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        success, response = self.run_test(
            "Monthly Report PDF",
            "GET",
            f"reports/monthly-pdf?month={current_month}&year={current_year}",
            200
        )
        return success

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚀 Starting Budget Control System API Tests...")
        print(f"🔗 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Core Authentication Tests
        print("\n📋 AUTHENTICATION TESTS")
        if not self.test_user_login():  # Try existing user first
            print("👤 No existing user found, testing registration...")
            if not self.test_user_registration():
                print("❌ Authentication setup failed - stopping tests")
                return self.get_summary()
        
        self.test_auth_me()
        
        # Budget Management Tests
        print("\n📊 BUDGET MANAGEMENT TESTS")
        self.test_budget_creation()
        self.test_budget_list()
        self.test_monthly_budgets_list()
        
        # Payment Tests
        print("\n💰 PAYMENT TESTS")
        self.test_payment_registration()
        
        # Dashboard Tests  
        print("\n📈 DASHBOARD TESTS")
        self.test_dashboard_kpi()
        self.test_monthly_summary()
        
        # Admin Features Tests
        print("\n🔧 ADMIN FEATURES TESTS")
        self.test_user_management()
        self.test_audit_logs()
        self.test_notification_config()
        
        # Reports Tests
        print("\n📄 REPORTS TESTS")
        self.test_reports()
        
        return self.get_summary()

    def get_summary(self):
        """Get test execution summary"""
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        print("\n" + "=" * 60)
        print("📊 TEST EXECUTION SUMMARY")
        print("=" * 60)
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 EXCELLENT! API is working well")
            return 0
        elif success_rate >= 60:
            print("⚠️  GOOD with some issues - check failed tests")
            return 1
        else:
            print("❌ POOR - Multiple critical issues found")
            return 1

def main():
    tester = BudgetControlAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())