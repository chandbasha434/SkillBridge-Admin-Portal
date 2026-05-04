import os
import secrets
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

# ─────────────────────────────────────────────
# App & config
# ─────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'qf-admin-secret-2026')
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(BASE_DIR, 'qf_admin.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# Auto-create tables on startup (works with gunicorn too)
with app.app_context():
    pass  # Tables created after models are defined — see bottom of file


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────
class Admin(db.Model):
    __tablename__ = 'admins'
    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(200), nullable=False)
    email        = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    opportunities = db.relationship('Opportunity', backref='admin', lazy=True,
                                    cascade='all, delete-orphan')
    reset_tokens  = db.relationship('PasswordResetToken', backref='admin', lazy=True,
                                    cascade='all, delete-orphan')


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'
    id         = db.Column(db.Integer, primary_key=True)
    admin_id   = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=False)
    token      = db.Column(db.String(100), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used       = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Opportunity(db.Model):
    __tablename__ = 'opportunities'
    id                   = db.Column(db.Integer, primary_key=True)
    admin_id             = db.Column(db.Integer, db.ForeignKey('admins.id'), nullable=False)
    name                 = db.Column(db.String(300), nullable=False)
    category             = db.Column(db.String(100), nullable=False)
    duration             = db.Column(db.String(100), nullable=False)
    start_date           = db.Column(db.String(50),  nullable=False)
    description          = db.Column(db.Text, nullable=False)
    skills               = db.Column(db.Text, nullable=False)   # comma-separated
    future_opportunities = db.Column(db.Text, nullable=False)
    max_applicants       = db.Column(db.Integer, nullable=True)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                   self.id,
            'name':                 self.name,
            'category':             self.category,
            'duration':             self.duration,
            'start_date':           self.start_date,
            'description':          self.description,
            'skills':               [s.strip() for s in self.skills.split(',') if s.strip()],
            'future_opportunities': self.future_opportunities,
            'max_applicants':       self.max_applicants,
            'created_at':           self.created_at.isoformat(),
        }


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
def login_required(f):
    """Decorator: return 401 if no active session."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'admin_id' not in session:
            return jsonify({'error': 'Unauthorized. Please log in.'}), 401
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────
# Static – serve admin.html at /
# ─────────────────────────────────────────────
@app.route('/')
@app.route('/<path:path>')
def index(path=''):
    # Block any unmatched /api/* routes — do not serve HTML for them
    if path.startswith('api/'):
        return jsonify({'error': 'Not found.'}), 404
    # Serve static assets directly
    if path in ('admin.css', 'admin.js'):
        return send_from_directory('sky', path)
    # All other paths get the SPA shell
    return send_from_directory('sky', 'admin.html')


# ─────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────

# US-1.1 Sign Up
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data             = request.get_json(silent=True) or {}
    name             = data.get('name', '').strip()
    email            = data.get('email', '').strip().lower()
    password         = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not all([name, email, password, confirm_password]):
        return jsonify({'error': 'All fields are required.'}), 400

    import re
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({'error': 'Please enter a valid email address.'}), 400

    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters.'}), 400

    if password != confirm_password:
        return jsonify({'error': 'Passwords do not match.'}), 400

    if Admin.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists.'}), 409

    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    admin   = Admin(name=name, email=email, password_hash=pw_hash)
    db.session.add(admin)
    db.session.commit()
    return jsonify({'message': 'Account created successfully.'}), 201


# US-1.2 Login
@app.route('/api/auth/login', methods=['POST'])
def login():
    data        = request.get_json(silent=True) or {}
    email       = (data.get('email') or '').strip().lower()
    password    = data.get('password') or ''
    remember_me = data.get('remember_me', False)

    admin = Admin.query.filter_by(email=email).first()
    if not admin or not bcrypt.check_password_hash(admin.password_hash, password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    session['admin_id']    = admin.id
    session['admin_email'] = admin.email
    session['admin_name']  = admin.name
    session.permanent      = bool(remember_me)

    return jsonify({
        'message': 'Login successful.',
        'admin': {'id': admin.id, 'name': admin.name, 'email': admin.email},
    }), 200


# Logout
@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully.'}), 200


# Session check – used by frontend on page load
@app.route('/api/auth/me', methods=['GET'])
def me():
    if 'admin_id' not in session:
        return jsonify({'error': 'Not authenticated.'}), 401
    return jsonify({
        'admin': {
            'id':    session['admin_id'],
            'name':  session['admin_name'],
            'email': session['admin_email'],
        }
    }), 200


# US-1.3 Forgot Password
@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    data  = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()

    admin = Admin.query.filter_by(email=email).first()
    if admin:
        token      = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)
        rt         = PasswordResetToken(admin_id=admin.id, token=token, expires_at=expires_at)
        db.session.add(rt)
        db.session.commit()
        # Log internally – no real email sending
        print(f"\n[RESET LINK] Email: {email}\n"
              f"  Link: http://localhost:5000/reset-password/{token}\n"
              f"  Expires: {expires_at} UTC\n")

    # Always return success (privacy)
    return jsonify({'message': 'If this email is registered, a reset link has been sent.'}), 200


# Reset Password (verify token)
@app.route('/api/auth/reset-password/<token>', methods=['POST'])
def reset_password(token):
    data         = request.get_json(silent=True) or {}
    new_password = data.get('password', '')

    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters.'}), 400

    rt = PasswordResetToken.query.filter_by(token=token, used=False).first()
    if not rt:
        return jsonify({'error': 'Invalid or already used reset link.'}), 400
    if datetime.utcnow() > rt.expires_at:
        return jsonify({'error': 'This reset link has expired. Please request a new one.'}), 400

    admin = Admin.query.get(rt.admin_id)
    admin.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    rt.used = True
    db.session.commit()
    return jsonify({'message': 'Password reset successfully.'}), 200


# ─────────────────────────────────────────────
# OPPORTUNITY ROUTES
# ─────────────────────────────────────────────

# US-2.1 View all (only this admin's)
@app.route('/api/opportunities', methods=['GET'])
@login_required
def get_opportunities():
    opps = (Opportunity.query
            .filter_by(admin_id=session['admin_id'])
            .order_by(Opportunity.created_at.desc())
            .all())
    return jsonify([o.to_dict() for o in opps]), 200


# US-2.2 Create
@app.route('/api/opportunities', methods=['POST'])
@login_required
def create_opportunity():
    data = request.get_json(silent=True) or {}

    name                 = data.get('name', '').strip()
    category             = data.get('category', '').strip()
    duration             = data.get('duration', '').strip()
    start_date           = data.get('start_date', '').strip()
    description          = data.get('description', '').strip()
    skills               = data.get('skills', '').strip()
    future_opportunities = data.get('future_opportunities', '').strip()
    max_applicants       = data.get('max_applicants')

    if not all([name, category, duration, start_date, description, skills, future_opportunities]):
        return jsonify({'error': 'All required fields must be filled.'}), 400

    opp = Opportunity(
        admin_id             = session['admin_id'],
        name                 = name,
        category             = category,
        duration             = duration,
        start_date           = start_date,
        description          = description,
        skills               = skills,
        future_opportunities = future_opportunities,
        max_applicants       = int(max_applicants) if max_applicants else None,
    )
    db.session.add(opp)
    db.session.commit()
    return jsonify(opp.to_dict()), 201


# US-2.5 Edit
@app.route('/api/opportunities/<int:opp_id>', methods=['PUT'])
@login_required
def update_opportunity(opp_id):
    opp = Opportunity.query.filter_by(id=opp_id, admin_id=session['admin_id']).first()
    if not opp:
        return jsonify({'error': 'Opportunity not found or access denied.'}), 404

    data = request.get_json(silent=True) or {}

    name                 = data.get('name', '').strip()
    category             = data.get('category', '').strip()
    duration             = data.get('duration', '').strip()
    start_date           = data.get('start_date', '').strip()
    description          = data.get('description', '').strip()
    skills               = data.get('skills', '').strip()
    future_opportunities = data.get('future_opportunities', '').strip()
    max_applicants       = data.get('max_applicants')

    if not all([name, category, duration, start_date, description, skills, future_opportunities]):
        return jsonify({'error': 'All required fields must be filled.'}), 400

    opp.name                 = name
    opp.category             = category
    opp.duration             = duration
    opp.start_date           = start_date
    opp.description          = description
    opp.skills               = skills
    opp.future_opportunities = future_opportunities
    opp.max_applicants       = int(max_applicants) if max_applicants else None

    db.session.commit()
    return jsonify(opp.to_dict()), 200


# US-2.6 Delete
@app.route('/api/opportunities/<int:opp_id>', methods=['DELETE'])
@login_required
def delete_opportunity(opp_id):
    opp = Opportunity.query.filter_by(id=opp_id, admin_id=session['admin_id']).first()
    if not opp:
        return jsonify({'error': 'Opportunity not found or access denied.'}), 404

    db.session.delete(opp)
    db.session.commit()
    return jsonify({'message': 'Opportunity deleted successfully.'}), 200


# ─────────────────────────────────────────────
# Bootstrap DB and run
# ─────────────────────────────────────────────
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("✓ Database tables created / verified.")
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
else:
    # Called by gunicorn — ensure tables exist
    with app.app_context():
        db.create_all()
