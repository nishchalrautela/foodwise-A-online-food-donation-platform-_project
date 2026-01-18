from datetime import date

class BaseModel:
    def to_dict(self):
        d = {c.name: getattr(self, c.name) for c in self.__table__.columns}
        for k, v in d.items():
            if isinstance(v, date):
                d[k] = v.isoformat()
        return d

def init_models(db):
    """Initialize models with the db instance"""
    
    class User(db.Model, BaseModel):
        __tablename__ = 'user'
        id = db.Column(db.Integer, primary_key=True)
        username = db.Column(db.String(80), unique=True, nullable=False)

    class Inventory(db.Model, BaseModel):
        __tablename__ = 'inventory'
        id = db.Column(db.Integer, primary_key=True)
        item_type = db.Column(db.String(200), nullable=False)
        quantity = db.Column(db.Float, default=0)
        quantity_remaining = db.Column(db.Float, default=0)
        date_prepared = db.Column(db.Date)
        status = db.Column(db.String(50), default='Available')
        category = db.Column(db.String(50), default='Human')
        platform_id = db.Column(db.Integer, db.ForeignKey('food_platform.id'))

        def to_dict(self):
            data = super().to_dict()
            if self.platform:
                data['platform'] = {
                    'id': self.platform.id,
                    'name': self.platform.name,
                    'address': self.platform.address,
                    'contact': self.platform.contact,
                }
            return data

    class NGO(db.Model, BaseModel):
        __tablename__ = 'ngo'
        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(200), nullable=False)
        address = db.Column(db.String(300))
        latitude = db.Column(db.Float)
        longitude = db.Column(db.Float)

    class Wastage(db.Model, BaseModel):
        __tablename__ = 'wastage'
        id = db.Column(db.Integer, primary_key=True)
        inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=False)
        quantity = db.Column(db.Float, nullable=False)
        reason = db.Column(db.String(300))
        logged_at = db.Column(db.DateTime, server_default=db.func.now())

    class Donation(db.Model, BaseModel):
        __tablename__ = 'donation'
        id = db.Column(db.Integer, primary_key=True)
        inventory_id = db.Column(db.Integer, db.ForeignKey('inventory.id'), nullable=False)
        ngo_id = db.Column(db.Integer, db.ForeignKey('ngo.id'), nullable=False)
        quantity = db.Column(db.Float, nullable=False)
        donated_at = db.Column(db.DateTime, server_default=db.func.now())

    class FoodPlatform(db.Model, BaseModel):
        __tablename__ = 'food_platform'
        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(200), nullable=False)
        address = db.Column(db.String(300))
        latitude = db.Column(db.Float)
        longitude = db.Column(db.Float)
        contact = db.Column(db.String(100))
        description = db.Column(db.String(500))

    class FoodRequest(db.Model, BaseModel):
        __tablename__ = 'food_request'
        id = db.Column(db.Integer, primary_key=True)
        ngo_id = db.Column(db.Integer, db.ForeignKey('ngo.id'), nullable=False)
        request_type = db.Column(db.String(50), default='Human')
        quantity_needed = db.Column(db.Float, nullable=False)
        description = db.Column(db.String(500))
        urgency = db.Column(db.String(50), default='Normal')
        status = db.Column(db.String(50), default='Pending')
        needed_by = db.Column(db.Date)
        created_at = db.Column(db.DateTime, server_default=db.func.now())
        claimed_platform_id = db.Column(db.Integer, db.ForeignKey('food_platform.id'))
        claimed_quantity = db.Column(db.Float)
        claimed_at = db.Column(db.DateTime)

        def to_dict(self):
            data = super().to_dict()
            if self.ngo:
                data['ngo'] = {
                    'id': self.ngo.id,
                    'name': self.ngo.name,
                    'address': self.ngo.address
                }
            if self.claimed_platform:
                data['claimed_platform'] = {
                    'id': self.claimed_platform.id,
                    'name': self.claimed_platform.name,
                    'address': self.claimed_platform.address
                }
            elif self.claimed_platform_id:
                data['claimed_platform'] = {
                    'id': self.claimed_platform_id
                }
            return data
    
    # Relationships
    Inventory.platform = db.relationship('FoodPlatform', backref='inventories', lazy=True)
    FoodRequest.ngo = db.relationship('NGO', backref='requests', lazy=True)
    FoodRequest.claimed_platform = db.relationship('FoodPlatform', backref='claimed_requests', lazy=True, foreign_keys=[FoodRequest.claimed_platform_id])
    
    return User, Inventory, NGO, Wastage, Donation, FoodPlatform, FoodRequest