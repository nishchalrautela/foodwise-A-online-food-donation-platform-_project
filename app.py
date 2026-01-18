from datetime import datetime, timedelta
import os

from flask import Flask, jsonify, render_template, request
from flask_sqlalchemy import SQLAlchemy
from werkzeug.exceptions import HTTPException
from sqlalchemy import inspect, text

from config import Config

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(Config)
    db.init_app(app)

    # Initialize models with db instance
    from models import init_models
    User, Inventory, NGO, Wastage, Donation, FoodPlatform, FoodRequest = init_models(db)

    # Store models in app for access outside routes
    app.User = User
    app.Inventory = Inventory
    app.NGO = NGO
    app.Wastage = Wastage
    app.Donation = Donation
    app.FoodPlatform = FoodPlatform
    app.FoodRequest = FoodRequest

    # ------------------ HELPERS ------------------

    def _is_api_request():
        return request.path.startswith('/api/')

    def _parse_date(value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value).date()
            except ValueError:
                return None
        return None

    def _parse_float(value):
        if value is None or value == '':
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _parse_int(value, default):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _json_error(message, status_code=400):
        response = jsonify({'status': 'error', 'error': message})
        response.status_code = status_code
        return response
    
    @app.context_processor
    def inject_globals():
        return {'datetime': datetime}

    @app.errorhandler(Exception)
    def handle_exception(error):
        if isinstance(error, HTTPException):
            code = error.code
            description = error.description
        else:
            code = 500
            description = 'An unexpected error occurred.'
            app.logger.exception(error)

        if _is_api_request():
            return _json_error(description, code)
        return render_template('error.html', code=code, message=description), code

    # ------------------ ROUTES ------------------
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/inventory')
    def inventory_page():
        platforms = FoodPlatform.query.all()
        return render_template('inventory.html', platforms=platforms)

    @app.route('/surplus-food')
    def surplus_food_page():
        return render_template('surplus.html')

    @app.route('/donations')
    def donations_page():
        return render_template('donations.html')

    @app.route('/analytics')
    def analytics_page():
        return render_template('analytics.html')

    @app.route('/requests')
    def requests_page():
        ngos = NGO.query.all()
        return render_template('requests.html', ngos=ngos)

    @app.route('/restaurants')
    def restaurants_page():
        platforms = FoodPlatform.query.all()
        return render_template('restaurants.html', platforms=platforms)

    @app.route('/maps')
    def maps_page():
        ngo_count = NGO.query.filter(
            NGO.latitude.isnot(None),
            NGO.longitude.isnot(None)
        ).count()
        platform_count = FoodPlatform.query.filter(
            FoodPlatform.latitude.isnot(None),
            FoodPlatform.longitude.isnot(None)
        ).count()
        google_maps_key = app.config.get('GOOGLE_MAPS_API_KEY', '').strip()
        
        # Check if API key is set and not placeholder
        if not google_maps_key or google_maps_key == 'your-google-maps-api-key-here':
            google_maps_key = ''
        
        return render_template(
            'maps.html',
            google_maps_key=google_maps_key,
            ngos_count=ngo_count,
            platforms_count=platform_count
        )

    # ------------------ API ROUTES ------------------

    @app.route('/api/inventory', methods=['GET', 'POST'])
    def api_inventory():
        if request.method == 'GET':
            query = Inventory.query.order_by(Inventory.id.desc())
            status = request.args.get('status')
            search = request.args.get('search')
            category = request.args.get('category')
            platform_id = request.args.get('platform_id')
            if status:
                query = query.filter(Inventory.status.ilike(f'%{status}%'))
            if search:
                query = query.filter(Inventory.item_type.ilike(f'%{search}%'))
            if category:
                query = query.filter(Inventory.category.ilike(f'%{category}%'))
            if platform_id:
                query = query.filter(Inventory.platform_id == platform_id)
            items = query.all()
            return jsonify([i.to_dict() for i in items])

        data = request.get_json(silent=True) or {}
        item_type = (data.get('item_type') or '').strip()
        if not item_type:
            return _json_error('Item type is required.')
        quantity = _parse_float(data.get('quantity'))
        if quantity is None or quantity < 0:
            return _json_error('Quantity must be a non-negative number.')
        quantity_remaining = _parse_float(data.get('quantity_remaining'))
        if quantity_remaining is None or quantity_remaining < 0:
            quantity_remaining = quantity
        date_prepared = _parse_date(data.get('date_prepared')) or datetime.utcnow().date()
        status_value = (data.get('status') or 'Available').strip().title()

        category_value = (data.get('category') or 'Human').strip().title()
        platform_id = data.get('platform_id')

        if platform_id:
            platform = FoodPlatform.query.get(platform_id)
            if not platform:
                return _json_error('Food platform not found.', 404)
        else:
            platform = None

        item = Inventory(
            item_type=item_type,
            quantity=quantity,
            quantity_remaining=quantity_remaining,
            date_prepared=date_prepared,
            status=status_value or 'Available',
            category=category_value or 'Human',
            platform_id=platform.id if platform else None
        )
        db.session.add(item)
        db.session.commit()
        return jsonify({'status': 'ok', 'item': item.to_dict()}), 201

    @app.route('/api/inventory/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
    def api_inventory_item(item_id):
        item = Inventory.query.get_or_404(item_id, description='Inventory item not found.')

        if request.method == 'GET':
            return jsonify(item.to_dict())

        if request.method == 'DELETE':
            db.session.delete(item)
            db.session.commit()
            return jsonify({'status': 'ok'})

        data = request.get_json(silent=True) or {}
        if 'item_type' in data:
            value = (data.get('item_type') or '').strip()
            if not value:
                return _json_error('Item type cannot be empty.')
            item.item_type = value
        if 'quantity' in data:
            new_quantity = _parse_float(data.get('quantity'))
            if new_quantity is None or new_quantity < 0:
                return _json_error('Quantity must be non-negative.')
            item.quantity = new_quantity
        if 'quantity_remaining' in data:
            new_remaining = _parse_float(data.get('quantity_remaining'))
            if new_remaining is None or new_remaining < 0:
                return _json_error('Quantity remaining must be non-negative.')
            item.quantity_remaining = new_remaining
        if 'status' in data:
            item.status = (data.get('status') or '').strip().title() or item.status
        if 'category' in data:
            new_category = (data.get('category') or '').strip().title()
            if new_category:
                item.category = new_category
        if 'platform_id' in data:
            platform_id = data.get('platform_id')
            if platform_id:
                platform = FoodPlatform.query.get(platform_id)
                if not platform:
                    return _json_error('Food platform not found.', 404)
                item.platform_id = platform.id
            else:
                item.platform_id = None
        if 'date_prepared' in data:
            parsed_date = _parse_date(data.get('date_prepared'))
            if not parsed_date:
                return _json_error('Invalid date format.')
            item.date_prepared = parsed_date

        db.session.commit()
        return jsonify({'status': 'ok', 'item': item.to_dict()})

    @app.route('/api/surplus-food', methods=['GET', 'POST'])
    def api_surplus_food():
        if request.method == 'GET':
            limit = _parse_int(request.args.get('limit', 20), 20)
            entries = (Wastage.query.order_by(Wastage.logged_at.desc())
                       .limit(limit).all())
            return jsonify([e.to_dict() for e in entries])

        data = request.get_json(silent=True) or {}
        inventory_id = data.get('inventory_id')
        quantity = _parse_float(data.get('quantity'))
        if not inventory_id:
            return _json_error('Inventory ID is required.')
        if quantity is None or quantity <= 0:
            return _json_error('Quantity must be greater than zero.')
        reason = (data.get('reason') or 'Not specified').strip()

        inv = Inventory.query.get(inventory_id)
        if not inv:
            return _json_error('Inventory item not found.', 404)

        entry = Wastage(
            inventory_id=inv.id,
            quantity=quantity,
            reason=reason or 'Not specified'
        )
        inv.quantity_remaining = max(0, inv.quantity_remaining - quantity)
        inv.status = 'Surplus' if inv.quantity_remaining == 0 else inv.status
        db.session.add(entry)
        db.session.commit()
        return jsonify({'status': 'ok', 'entry': entry.to_dict()})

    @app.route('/api/donations', methods=['GET', 'POST'])
    def api_donations():
        if request.method == 'GET':
            limit = _parse_int(request.args.get('limit', 20), 20)
            entries = (Donation.query.order_by(Donation.donated_at.desc())
                       .limit(limit).all())
            return jsonify([e.to_dict() for e in entries])

        data = request.get_json(silent=True) or {}
        inventory_id = data.get('inventory_id')
        ngo_id = data.get('ngo_id')
        quantity = _parse_float(data.get('quantity'))
        if not inventory_id or not ngo_id:
            return _json_error('Inventory ID and NGO ID are required.')
        if quantity is None or quantity <= 0:
            return _json_error('Quantity must be greater than zero.')

        inv = Inventory.query.get(inventory_id)
        if not inv:
            return _json_error('Inventory item not found.', 404)
        ngo = NGO.query.get(ngo_id)
        if not ngo:
            return _json_error('NGO not found.', 404)

        entry = Donation(
            inventory_id=inv.id,
            ngo_id=ngo.id,
            quantity=quantity
        )
        inv.quantity_remaining = max(0, inv.quantity_remaining - quantity)
        inv.status = 'Donated' if inv.quantity_remaining == 0 else inv.status
        db.session.add(entry)
        db.session.commit()
        return jsonify({'status': 'ok', 'entry': entry.to_dict()})

    @app.route('/api/ngos', methods=['GET'])
    def api_ngos():
        return jsonify([n.to_dict() for n in NGO.query.all()])

    @app.route('/api/food-platforms', methods=['GET'])
    def api_food_platforms():
        return jsonify([p.to_dict() for p in FoodPlatform.query.all()])

    @app.route('/api/locations', methods=['GET'])
    def api_locations():
        """Get all NGOs and Food Platforms with location data"""
        ngos = NGO.query.filter(
            NGO.latitude.isnot(None),
            NGO.longitude.isnot(None)
        ).all()
        platforms = FoodPlatform.query.filter(
            FoodPlatform.latitude.isnot(None),
            FoodPlatform.longitude.isnot(None)
        ).all()
        return jsonify({
            'ngos': [n.to_dict() for n in ngos],
            'platforms': [p.to_dict() for p in platforms]
        })

    @app.route('/api/restaurants/submissions', methods=['POST'])
    def api_restaurant_submissions():
        data = request.get_json(silent=True) or {}
        platform_id = data.get('platform_id')
        if not platform_id:
            return _json_error('Food platform ID is required.')
        platform = FoodPlatform.query.get(platform_id)
        if not platform:
            return _json_error('Food platform not found.', 404)

        item_type = (data.get('item_type') or '').strip()
        if not item_type:
            return _json_error('Item type is required.')

        quantity = _parse_float(data.get('quantity'))
        if quantity is None or quantity <= 0:
            return _json_error('Quantity must be greater than zero.')

        category = (data.get('category') or 'Human').strip().title()
        if category not in ['Human', 'Pet']:
            return _json_error('Category must be Human or Pet.')

        date_prepared = _parse_date(data.get('date_prepared')) or datetime.utcnow().date()

        item = Inventory(
            item_type=item_type,
            quantity=quantity,
            quantity_remaining=quantity,
            date_prepared=date_prepared,
            status='Available',
            category=category,
            platform_id=platform.id
        )
        db.session.add(item)
        db.session.commit()
        return jsonify({'status': 'ok', 'item': item.to_dict()}), 201

    @app.route('/api/food-requests', methods=['GET', 'POST'])
    def api_food_requests():
        if request.method == 'GET':
            query = FoodRequest.query.order_by(FoodRequest.created_at.desc())
            status = request.args.get('status')
            request_type = request.args.get('type')
            if status:
                query = query.filter(FoodRequest.status.ilike(f'%{status}%'))
            if request_type:
                query = query.filter(FoodRequest.request_type.ilike(f'%{request_type}%'))
            requests_data = query.all()
            return jsonify([r.to_dict() for r in requests_data])

        data = request.get_json(silent=True) or {}
        ngo_id = data.get('ngo_id')
        if not ngo_id:
            return _json_error('NGO ID is required.')
        ngo = NGO.query.get(ngo_id)
        if not ngo:
            return _json_error('NGO not found.', 404)

        quantity = _parse_float(data.get('quantity_needed'))
        if quantity is None or quantity <= 0:
            return _json_error('Quantity needed must be greater than zero.')

        request_type = (data.get('request_type') or 'Human').strip().title()
        if request_type not in ['Human', 'Pet']:
            return _json_error('Request type must be Human or Pet.')

        urgency = (data.get('urgency') or 'Normal').strip().title()
        description = (data.get('description') or '').strip()
        needed_by = _parse_date(data.get('needed_by'))

        req = FoodRequest(
            ngo_id=ngo.id,
            request_type=request_type,
            quantity_needed=quantity,
            description=description,
            urgency=urgency or 'Normal',
            needed_by=needed_by
        )
        db.session.add(req)
        db.session.commit()
        return jsonify({'status': 'ok', 'request': req.to_dict()}), 201

    @app.route('/api/food-requests/<int:req_id>', methods=['PUT'])
    def api_food_request_update(req_id):
        req = FoodRequest.query.get_or_404(req_id, description='Request not found.')
        data = request.get_json(silent=True) or {}
        if 'status' in data:
            status_value = (data.get('status') or '').strip().title()
            if status_value:
                req.status = status_value
        if 'urgency' in data:
            req.urgency = (data.get('urgency') or req.urgency).strip().title()
        if 'description' in data:
            req.description = (data.get('description') or req.description).strip()
        if 'claimed_platform_id' in data:
            platform_id = data.get('claimed_platform_id')
            if platform_id:
                platform = FoodPlatform.query.get(platform_id)
                if not platform:
                    return _json_error('Food platform not found.', 404)
                req.claimed_platform_id = platform.id
                req.claimed_at = datetime.utcnow()
                req.status = data.get('status', 'Claimed')
            else:
                req.claimed_platform_id = None
                req.claimed_at = None
        if 'claimed_quantity' in data:
            claimed_qty = _parse_float(data.get('claimed_quantity'))
            if claimed_qty is not None and claimed_qty < 0:
                return _json_error('Claimed quantity must be non-negative.')
            req.claimed_quantity = claimed_qty
        db.session.commit()
        return jsonify({'status': 'ok', 'request': req.to_dict()})

    @app.route('/api/analytics', methods=['GET'])
    def api_analytics():
        total_wasted = db.session.query(db.func.sum(Wastage.quantity)).scalar() or 0
        total_donated = db.session.query(db.func.sum(Donation.quantity)).scalar() or 0
        total_inventory = db.session.query(db.func.sum(Inventory.quantity)).scalar() or 0
        remaining_inventory = db.session.query(db.func.sum(Inventory.quantity_remaining)).scalar() or 0
        return jsonify({
            'total_wasted': float(total_wasted),
            'total_donated': float(total_donated),
            'total_inventory': float(total_inventory),
            'total_remaining': float(remaining_inventory)
        })

    @app.route('/api/analytics/trends', methods=['GET'])
    def api_analytics_trends():
        days = _parse_int(request.args.get('days', 7), 7)
        days = max(1, min(days, 30))
        start_date = datetime.utcnow().date() - timedelta(days=days - 1)

        def daily_totals(date_column, quantity_column):
            rows = (db.session.query(db.func.date(date_column).label('day'),
                                     db.func.sum(quantity_column))
                    .filter(date_column >= start_date)
                    .group_by('day')
                    .order_by('day')
                    .all())
            totals = {str(row.day): float(row[1]) for row in rows if row[0]}
            return totals

        wasted = daily_totals(Wastage.logged_at, Wastage.quantity)
        donated = daily_totals(Donation.donated_at, Donation.quantity)
        produced = daily_totals(Inventory.date_prepared, Inventory.quantity)

        labels = [
            (start_date + timedelta(days=i)).isoformat()
            for i in range(days)
        ]
        return jsonify({
            'labels': labels,
            'wasted': [wasted.get(label, 0) for label in labels],
            'donated': [donated.get(label, 0) for label in labels],
            'produced': [produced.get(label, 0) for label in labels]
        })

    @app.route('/api/health', methods=['GET'])
    def api_health():
        inventory_count = Inventory.query.count()
        ngo_count = NGO.query.count()
        return jsonify({
            'status': 'ok',
            'inventory_items': inventory_count,
            'ngos': ngo_count
        })

    return app


def _ensure_schema(food_request_model):
    """Make sure new columns/tables exist for legacy SQLite DBs."""
    engine = db.engine
    inspector = inspect(engine)
    conn = engine.connect()
    try:
        tables = inspector.get_table_names()

        # Inventory column backfills
        if 'inventory' in tables:
            inv_columns = {col['name'] for col in inspector.get_columns('inventory')}
            if 'category' not in inv_columns:
                conn.execute(text("ALTER TABLE inventory ADD COLUMN category VARCHAR(50) DEFAULT 'Human'"))
            if 'platform_id' not in inv_columns:
                conn.execute(text("ALTER TABLE inventory ADD COLUMN platform_id INTEGER"))

        # Food request table + columns
        if 'food_request' not in tables:
            food_request_model.__table__.create(engine)
        else:
            req_columns = {col['name'] for col in inspector.get_columns('food_request')}
            if 'claimed_platform_id' not in req_columns:
                conn.execute(text("ALTER TABLE food_request ADD COLUMN claimed_platform_id INTEGER"))
            if 'claimed_quantity' not in req_columns:
                conn.execute(text("ALTER TABLE food_request ADD COLUMN claimed_quantity FLOAT"))
            if 'claimed_at' not in req_columns:
                conn.execute(text("ALTER TABLE food_request ADD COLUMN claimed_at DATETIME"))
    finally:
        conn.close()


def _seed_reference_data(app):
    needs_commit = False
    if app.NGO.query.count() == 0:
        ngos = [
            app.NGO(
                name='Helping Hands',
                address='Near Central Park, New Delhi',
                latitude=28.6139,
                longitude=77.2090,
            ),
            app.NGO(
                name='Food for All',
                address='MG Road, Bangalore',
                latitude=12.9716,
                longitude=77.5946,
            ),
            app.NGO(
                name='Community Kitchen',
                address='Marine Drive, Mumbai',
                latitude=18.9407,
                longitude=72.8353,
            ),
        ]
        db.session.add_all(ngos)
        needs_commit = True

    if app.FoodPlatform.query.count() == 0:
        platforms = [
            app.FoodPlatform(
                name='FoodWise Kitchen',
                address='Central Food Hub, New Delhi',
                latitude=28.6139,
                longitude=77.2090,
                contact='foodwise@example.com',
                description='Main kitchen facility for food preparation and distribution',
            ),
            app.FoodPlatform(
                name='Community Food Center',
                address='Downtown Location, Bangalore',
                latitude=12.9352,
                longitude=77.6245,
                contact='community@example.com',
                description='Local food preparation and donation center',
            ),
        ]
        db.session.add_all(platforms)
        needs_commit = True

    if needs_commit:
        db.session.commit()
        print("✅ Database initialized with NGOs and Food Platforms!")


if __name__ == '__main__':
    app = create_app()
    os.makedirs(app.instance_path, exist_ok=True)

    # Initialize database inside app context
    with app.app_context():
        db.create_all()
        _ensure_schema(app.FoodRequest)
        _seed_reference_data(app)

    app.run(debug=True)